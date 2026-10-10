import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'node:crypto';
import {defineConfig, type Plugin} from 'vite';
import { PDFJS_ASSET_BASE, PDFJS_ASSET_DIRS } from './src/utils/pdfAssets';

/**
 * PDF.js auxiliary data (CMaps, standard fonts, wasm decoders, ICC profiles). PDF.js 6 ships
 * these in its package but has no default location for them, so this serves the folders in
 * development and copies them into the build, at the URLs src/utils/pdfAssets.ts hands to
 * getDocument(). Files are copied verbatim; nothing here is generated.
 */
function pdfjsAssets(): Plugin {
  const packageDir = path.resolve(__dirname, 'node_modules/pdfjs-dist');
  let outDir = 'dist';
  const contentType = (file: string) => (file.endsWith('.wasm') ? 'application/wasm' : 'application/octet-stream');
  return {
    name: 'pdfjs-assets',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url ?? '').split('?')[0];
        if (!url.startsWith(PDFJS_ASSET_BASE)) return next();
        const [dir, file, ...rest] = url.slice(PDFJS_ASSET_BASE.length).split('/');
        if (!(PDFJS_ASSET_DIRS as readonly string[]).includes(dir) || !file || rest.length || file.includes('..')) return next();
        const absolute = path.join(packageDir, dir, file);
        if (!fs.existsSync(absolute)) return next();
        res.setHeader('Content-Type', contentType(file));
        fs.createReadStream(absolute).pipe(res);
      });
    },
    closeBundle() {
      for (const dir of PDFJS_ASSET_DIRS) {
        fs.cpSync(path.join(packageDir, dir), path.join(outDir, PDFJS_ASSET_BASE.replace(/^\/|\/$/g, ''), dir), { recursive: true });
      }
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      pdfjsAssets(),
      // Lightweight API endpoint to persist notes to the local filesystem
      {
        name: 'notes-persistence',
        configureServer(server) {
          server.middlewares.use('/api/save-notes', async (req, res, next) => {
            // Only accept POST
            if (req.method !== 'POST') return next();

            // Collect the request body
            const chunks: Buffer[] = [];
            for await (const chunk of req) chunks.push(Buffer.from(chunk));
            const body = Buffer.concat(chunks).toString('utf-8');

            try {
              const { fileName, notes } = JSON.parse(body);
              if (!fileName || !Array.isArray(notes)) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: 'Missing fileName or notes array' }));
                return;
              }

              // Sanitize filename to prevent path traversal
              const safeName = fileName.replace(/[^a-zA-Z0-9_\-\s\.\(\)]/g, '_').slice(0, 200);
              const notesDir = path.resolve(__dirname, 'notes');
              const filePath = path.join(notesDir, `${safeName}.rapture`);

              // Create notes/ directory if it doesn't exist
              if (!fs.existsSync(notesDir)) {
                fs.mkdirSync(notesDir, { recursive: true });
              }

              const payload = JSON.stringify(
                {
                  version: 1,
                  type: 'rapture-eyeliner-notes',
                  exportedAt: new Date().toISOString(),
                  fileName,
                  notes,
                },
                null,
                2,
              );

              const temporary = path.join(notesDir, '.rapture-' + randomUUID() + '.tmp');
              try {
                const fd = fs.openSync(temporary, 'wx');
                try { fs.writeFileSync(fd, payload, 'utf-8'); fs.fsyncSync(fd); }
                finally { fs.closeSync(fd); }
                fs.renameSync(temporary, filePath);
              } finally {
                if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
              }

              res.end(JSON.stringify({ ok: true, path: filePath }));
            } catch (err: any) {
              console.error('Failed to save notes file:', err);
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message }));
            }
          });
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // Always enable HMR and file watching for local development.
      // On each file change, Vite automatically hot-reloads the browser.
      hmr: true,
      // Tauri watches Rust itself. Avoid watching locked Cargo build outputs.
      watch: { ignored: ['**/src-tauri/**', '**/notes/**', '**/Notes/**'] },
    },
  };
});
