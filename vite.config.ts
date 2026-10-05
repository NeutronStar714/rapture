import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'node:crypto';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
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
