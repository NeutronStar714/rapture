# Rapture

Rapture is a lightweight offline desktop note-taking tool by **NeutronStar714**. Open a PDF or EPUB in the same viewer and attach notes directly to the document. Annotations stay visible at a precise reading position and can travel in separate, readable files.

Its defining feature is **Eyeliner**, a red horizontal line that marks a position on a PDF page or a line of EPUB text. Each line has an editable note in the Notes Deck. Notes are stored separately as small, readable `.rapture` files and can be imported onto another document of the same format without modifying the original.

The **Highlighter** marks selected text in translucent Rapture red. Enable it in the Notes Deck, then drag across text to toggle the selection between highlighted and plain. Each continuous range on a page or in a chapter is one editable note. Removing the middle creates two notes with the original comment. Filling a gap joins adjacent highlights and combines their comments. Deleting a note removes its mark. Use **Move** to select a new location, or press Escape to leave marking mode.

## Reading EPUBs

Open or drop a reflowable `.epub` the same way you open a PDF. The library remembers recent books and the reading position. It shows the book's cover image, or a preview of the first page when the book has no cover artwork. The chapter picker and internal book links let you navigate without treating chapters as PDF pages.

EPUB text fills the reader width with adjustable side margins. The percentage beside the chapter picker shows progress through the current chapter based on the viewer’s center. It is on by default and can be hidden with **Show chapter progress** in **EPUB Options**. The same panel controls text size (30px by default), font (Georgia by default), alignment, line spacing, margins, and reading theme. EPUB preferences are saved locally. When the window or typography changes, Rapture keeps the text at the vertical center in view.

Use `Ctrl`/`Command` + `+` or `-` in the EPUB reader to adjust the font size by 1px.

Rapture supports DRM-free, reflowable EPUB books. It uses its own typography and displays the book’s chapters and supported local raster images. It collapses repeated blank rows while preserving paragraph spacing and distinct scene breaks.

## Taking notes

1. Open a PDF or EPUB using the file picker or dropzone, or try the built-in PDF sample.
2. Use the shared sidebar and search to navigate. The selected search result flashes red when you open it. PDFs offer thumbnails, an outline, and page navigation. EPUBs offer a chapter picker and chapter list.
3. Open Notes and enable **Eyeliner** (`E` outside text fields). Click a position in the document to place a line, then enter its note in the Notes Deck.
4. Use the note controls to jump to a mark, move it, or delete it. **Locate nearest note** finds the mark closest to the viewer's vertical center. **Revision** gives the Notes Deck more space.
5. Export notes as a `.rapture` file. Importing one replaces the current notes after confirmation when its notes use the current document format.

Both formats offer light, dark, and sepia themes and presentation mode. PDFs also support zoom (`Ctrl`/`Command` + `+` or `-`), rotation, page layouts, document information, and printing. Recent documents and reading positions are stored locally.

Click **NOTES DECK** to open **Notes Config**. General Settings control text size and position labels. Export Settings offer `.rapture` and Markdown (`.md`). Markdown starts each note with a position and form, such as `**P3** **42%** **Highlight**` or `**Ch. 3** **42%** **Highlight**`, followed by the comment. Options include ordering, empty comments, a document heading, and quotations of highlighted or nearby text. Import accepts `.rapture` files.

PDF Eyeliner notes use a page and height. PDF highlights use page text offsets and redraw after zoom or rotation. EPUB notes use chapter text offsets so marks follow the text when the font, margins, or window size changes. Positions depend on the document's structure, so import works best with the same edition. Highlighting requires selectable text.

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

`pageNumber` is a one-based PDF page or EPUB chapter. For PDFs, `yPercent` gives the vertical page position from 0 to 1. For EPUBs, it gives progress through the chapter text. File-format version `1` is independent of the application version.

Highlight notes add `highlight: { "start": 0, "end": 12 }`. These are zero-based UTF-16 text offsets with an exclusive end. EPUB notes add `epubOffset`, the offset of an Eyeliner mark or the start of a highlight. Existing PDF Eyeliner and highlight files continue to load.

The current implementation uses three storage layers:

| Layer | Contents |
| --- | --- |
| IndexedDB | PDF and EPUB bytes, plus cached PDF page sizes, text, outline, metadata, and cover image. |
| localStorage | Notes, recent-document list, and reading position/layout. |
| Filesystem | Debounced `.rapture` autosaves and explicit exports. Desktop saves use Rust; browser development uses Vite middleware. |

Reopening restores notes from localStorage, not automatically from sidecar files. Storage is currently keyed by filename, so identically named PDFs can collide. Edits are backed up locally immediately and saved to disk after a short pause. Document switches and desktop close wait for queued saves; failures keep the document open and show a retry action. Explicit exports remain useful as portable backups. Browser tab closure cannot guarantee completion of asynchronous file writes. Desktop autosaves go to the `notes/` folder inside Rapture's per-user data directory: `%APPDATA%\Rapture` on Windows and `~/Library/Application Support/Rapture` on macOS, for debug and release builds alike. Set the `RAPTURE_DATA_DIR` environment variable to use a different folder. Browser development writes to the project's `notes/`.

## Architecture

Rapture uses **React 19 + TypeScript** for the interface, **PDF.js** for local PDF parsing/rendering, **fflate** and **DOMPurify** for local EPUB extraction and markup sanitization, **Vite + Tailwind CSS** for frontend tooling, and **Tauri 2 + Rust** for the desktop host. Motion provides UI animation and Lucide provides icons.

```text
Local PDF or EPUB -> Shared React viewer and Notes Deck
                          |                    |
                PDF.js or EPUB renderer        v
                                localStorage + Tauri/Rust .rapture saves
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

Document parsing and note-taking run locally. The interface fonts ship with the app, and EPUB can use fonts already installed on the system. Filesystem autosave runs in Tauri or through Vite's development endpoint.

## Desktop releases and platform support

```sh
npm run desktop:exe    # Release executable without installer bundles
npm run desktop:build  # Release app plus platform bundles/installers
```

With default Windows Cargo settings, the executable is `src-tauri/target/release/rapture.exe`, and installers are under `src-tauri/target/release/bundle/`. Release builds bundle the frontend and do not require Node.js, a Vite server, or an open browser tab. Windows uses WebView2; an installer can handle that prerequisite. Configure signing before publication.

Windows native development builds have been compiled here. The native layer now builds and resolves its storage paths on macOS as well; a full macOS runtime pass is in progress. **Cross-platform compatibility is a standing constraint on all new work:** new code must be platform-neutral on arrival, and no new OS-specific behavior should be introduced with "port it later" as the plan. The native layer's three Windows-only path behaviours (reading `APPDATA` directly, deriving debug paths from the executable location, and writing `Notes/` where browser development used `notes/`) have been replaced by Tauri's platform path resolver and a single lowercase `notes/` folder; on macOS, Quit (Cmd+Q) now routes through the window close path so pending notes and window state are saved. Packaging, signing, notarization, and Finder file associations are still absent. Build macOS packages on macOS. See [ARCHITECTURE_REPORT.md](ARCHITECTURE_REPORT.md) for the full architecture and macOS readiness assessment.

### Windows in-app updates

The library checks the latest public stable release on GitHub. **New Version** appears beside the heading when that release contains a newer `Rapture_<version>_x64_en-US.msi` with a GitHub SHA-256 digest. The check compares the MSI filename version with the installed app version. The dialog links to the GitHub release notes. **Install** saves pending notes, downloads and checks the MSI, opens Windows Installer, and closes Rapture so the installer can replace it. Reopen Rapture after the installer finishes. Updates require an internet connection. Opening documents and taking notes work offline.

Build with `npm run desktop:build -- --bundles msi` and attach the versioned MSI from `src-tauri/target/release/bundle/msi/` to the [Rapture GitHub release](https://github.com/NeutronStar714/rapture/releases). Publish it as the latest stable release. GitHub provides the digest used by this flow. Existing installations need to install an updater-enabled build once. The Windows desktop preview checks the live release feed. Installation is available in packaged builds.

## Version and dependency policy

The application version is **1.6.3**. Keep `package.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json` aligned and update their lockfiles, this README, and [CHANGELOG.md](CHANGELOG.md) with each app change. The `.rapture` format remains at version `1`.

Frontend runtime dependencies include React, React DOM, PDF.js, the Tauri API, Lucide, Motion, bundled fonts, fflate, and DOMPurify. Vite, its plugins, Tailwind, the Tauri CLI, TypeScript, and Node type definitions are development dependencies. Unused starter declarations for Gemini, Express, dotenv, tsx, Autoprefixer, and direct esbuild were removed; build tools may still depend on esbuild transitively.
