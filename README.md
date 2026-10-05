# Rapture

Rapture is a lightweight, offline PDF viewing and note-taking desktop app by **NeutronStar714**. Its priorities are document compatibility and explicit notes: annotations stay visible, tied to a precise reading position, and easy to carry between documents.

Its defining feature is **Eyeliner**, a red horizontal line that records a vertical position on a PDF page. Each line has an editable note in the Notes Deck. Notes are stored separately as small, readable `.rapture` files and can be imported onto any PDF without modifying the original document.

## Reading and taking notes

1. Open a local PDF using the file picker or dropzone, or try the built-in sample document.
2. Read in single-page, double-page, continuous single-page, or continuous double-page layouts. Use thumbnails, the document outline, page navigation, or text search to move around.
3. Open Notes and enable **Eyeliner** (shortcut: `E` outside text fields). Click a position on a page to place a line, then enter its note in the Notes Deck.
4. Use each note's controls to jump to its line, reposition it, or delete it. Revision mode gives the notes more space alongside the PDF.
5. Export notes as a `.rapture` file. Importing one replaces the current document's notes after confirmation, even if it was created for a different PDF.

Other controls include zoom (`Ctrl`/`Command` + `+` or `-`), rotation, light/dark/sepia themes, presentation mode, document information, PDF download, and printing. Recent documents and reading positions are stored locally.

Note portability is positional: a note records a page number and a height within that page. Applying notes to another edition does not automatically match text or compensate for changed pagination. Exported notes are separate from the PDF; downloading the PDF does not embed Eyeliner annotations.

## The `.rapture` format and local storage

A `.rapture` file is JSON with this envelope:

```json
{
  "version": 1,
  "type": "rapture-eyeliner-notes",
  "exportedAt": "2026-09-25T00:00:00.000Z",
  "fileName": "example.pdf",
  "notes": [
    {
      "id": "eyeliner-1",
      "pageNumber": 1,
      "yPercent": 0.4,
      "text": "Review this explanation.",
      "timestamp": 1790294400000
    }
  ]
}
```

`pageNumber` is one-based; `yPercent` runs from 0 (top) to 1 (bottom). The source filename is descriptive, not an import restriction. File-format version `1` is independent of the application's version.

The current implementation uses three storage layers:

| Layer | Contents |
| --- | --- |
| IndexedDB | PDF bytes and cached page sizes, text, outline, metadata, and cover image. |
| localStorage | Notes, recent-document list, and reading position/layout. |
| Filesystem | Debounced `.rapture` autosaves and explicit exports. Desktop saves use Rust; browser development uses Vite middleware. |

Reopening restores notes from localStorage, not automatically from sidecar files. Storage is currently keyed by filename, so identically named PDFs can collide. Edits are backed up locally immediately and saved to disk after a short pause. Document switches and desktop close wait for queued saves; failures keep the document open and show a retry action. Explicit exports remain useful as portable backups. Browser tab closure cannot guarantee completion of asynchronous file writes. Windows release autosaves currently target `%APPDATA%\Rapture\Notes`; standard debug builds use the project `Notes` directory. Browser development writes to `notes/`.

## Architecture

Rapture uses **React 19 + TypeScript** for the interface, **PDF.js** for local PDF parsing/rendering, **Vite + Tailwind CSS** for frontend tooling, and **Tauri 2 + Rust** for the desktop host. Motion provides UI animation and Lucide provides icons.

```text
Local PDF -> React document controller -> PDF.js + bundled worker
                      |                         |
                      |                  Canvas + selectable text
                      v
            IndexedDB / localStorage
                      |
                 Eyeliner notes
                      |
          Tauri commands -> Rust -> .rapture files
```

| Location | Role |
| --- | --- |
| `src/App.tsx` | Document loading, search indexing, reader state, layouts, and Eyeliner coordination. |
| `src/components/` | Toolbar, sidebars, notes editor, page/thumbnail rendering, dropzone, and document information. |
| `src/types.ts` | Frontend document, cache, and note types. |
| `src/utils/db.ts` | IndexedDB persistence. |
| `src/utils/tauri.ts` | Native note-save/export bridge with browser fallback detection. |
| `src-tauri/src/lib.rs` | Native file writes, export dialog, and window-state persistence. |
| `src-tauri/tauri.conf.json` | Desktop window and packaging configuration. |
| `vite.config.ts` | Frontend tooling and development-only note-saving endpoint. |

Page and thumbnail rendering is deferred near the viewport. Initial loading still indexes the whole document when no cache exists. The Rust layer is small; most application behavior lives in TypeScript.

## Run and inspect changes

Development requires Node.js compatible with the installed PDF.js package (Node 22.13+ within the 22 line, or 24+), Rust, and native build tools. On Windows, install the MSVC C++ build tools and WebView2. See [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/).

```sh
npm ci
npm run desktop:dev
```

On Windows, double-click `rapture.bat` for the same workflow. Keep the development process running: React/TypeScript/CSS changes update the open desktop window, and Rust changes rebuild and restart it. Some changes reset UI state. Restart after changing startup scripts.

Tauri starts Vite automatically on localhost port 3000. Do not run a second development server on that port. To inspect only the interface in a browser, use `npm run dev` and open `http://localhost:3000`; stop it before starting desktop development. Browser storage and native capabilities differ from the desktop app.

```sh
npm run lint   # TypeScript checks
npm run build  # Frontend production build
npm run test:notes # Note persistence regression tests (Node 22.13+ / 24+)
cargo test --manifest-path src-tauri/Cargo.toml # Native atomic-write tests
```

No cloud API key is required. PDF parsing and note-taking are local. The stylesheet still requests Google Fonts; local font bundling is needed for completely self-contained typography. A static web build does not include the development filesystem-saving endpoint.

## Desktop releases and platform support

```sh
npm run desktop:exe    # Release executable without installer bundles
npm run desktop:build  # Release app plus platform bundles/installers
```

With default Windows Cargo settings, the executable is `src-tauri/target/release/rapture.exe`, and installers are under `src-tauri/target/release/bundle/`. Release builds bundle the frontend and do not require Node.js, a Vite server, or an open browser tab. Windows uses WebView2; an installer can handle that prerequisite. Configure signing before publication.

Windows native development builds have been compiled here. macOS is a target, not yet verified support. **Cross-platform compatibility is a standing constraint on all new work:** new code must be platform-neutral on arrival, and no new OS-specific behavior should be introduced with "port it later" as the plan. The known macOS gaps are deliberately deferred to a single dedicated pass — the frontend is already platform-neutral, but the native layer is Windows-only in three concrete ways: it reads the Windows `APPDATA` environment variable directly (undefined on macOS, leaving relative paths), it derives debug paths by walking up a fixed number of parent directories from the executable, and it writes notes to `Notes/` while browser development uses `notes/` — two different directories on a case-sensitive filesystem. Packaging, signing, notarization, and Finder file associations are also absent. Build macOS packages on macOS. See [ARCHITECTURE_REPORT.md](ARCHITECTURE_REPORT.md) for the full architecture and macOS readiness assessment.

## Version and dependency policy

The application version is **1.1.720**, preserving the existing Rust version. Keep `package.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json` aligned when releasing; update their lockfiles too. This does not change `.rapture` format version `1`.

Frontend runtime dependencies are limited to React, React DOM, PDF.js, the Tauri API, Lucide, and Motion. Vite, its plugins, Tailwind, the Tauri CLI, TypeScript, and Node type definitions are development dependencies. Unused starter declarations for Gemini, Express, dotenv, tsx, Autoprefixer, and direct esbuild were removed; build tools may still depend on esbuild transitively.
