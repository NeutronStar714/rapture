# Rapture: architecture and cross-platform (macOS) readiness

Full re-scan of the repository root and source tree, 26 September 2026. Scope: source, configuration, persistence, build, and tests. No application behavior was changed. All findings below were re-verified against current code; this document supersedes the earlier dated assessment, several of whose findings have since been fixed and are now recorded as resolved.

Toolchain used for verification: Node v24.16.0, npm 11.13.0, rustc/cargo 1.97.1, Windows host.

## 1. What Rapture is

An offline-first PDF reader whose defining feature is **Eyeliner**: a red horizontal line the user drops at a vertical position on a page, with an editable note attached. Notes live outside the PDF in a small JSON `.rapture` sidecar (`version`, `type`, `exportedAt`, `fileName`, `notes[]`), where each note carries `id`, one-based `pageNumber`, normalized `yPercent` (0–1), `text`, and `timestamp`. The PDF is never modified, so notes are explicitly portable — and deliberately positional, not textual.

## 2. Provenance / authorship trail

The repository bears the marks of three distinct passes, which explains some of the inconsistencies catalogued later:

| Generation | Evidence in tree | Character of its contribution |
| --- | --- | --- |
| **Google AI Studio (Gemini)** | `metadata.json` (`requestFramePermissions`, AI Studio schema), `assets/.aistudio/.gitignore`, the commented "Tutorial / walkthrough" prose in `src/utils/samplePdf.ts` (it advertises pinch-zoom and per-page rotation that the code does not implement) | React + Vite + Tailwind shell, PDF.js wiring, single-file `App.tsx` controller, IndexedDB layer, visual design system (`#AA262C` crimson, Inter/Space Grotesk/JetBrains Mono) |
| **deepseek-v4-pro** | `src/utils/notePersistence.ts`, `src-tauri/src/atomic_write.rs`, `tests/notePersistence.test.mjs` | Hardened the note pipeline: revisioned serialized write queue, atomic temp-file-and-rename writes, close protection, regression tests, Tauri desktop host |
| **chatgpt-6 astra** | `README.md`, this report's predecessor, doc-comment cleanup | Documentation consolidation, version/dependency alignment, architecture review |

Net effect: the **runtime code is in better shape than the docs implied**. Specifically, the three version strings now agree at `1.1.720` (`package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`), unused starter dependencies (Gemini, Express, dotenv, tsx, Autoprefixer, direct esbuild) are gone, and the stale-closure note-loss bug is fixed.

## 3. Architecture

Three layers: a Python-free, server-free React frontend; a browser-storage persistence layer; and a thin Rust host that exists only because browsers cannot write to arbitrary filesystem paths.

```text
Local PDF ──► App.tsx (document controller) ──► PDF.js + bundled worker
                    │                                │
                    │                        Canvas + TextLayer
                    ▼
        IndexedDB (pdf_store, pdf_cache)     localStorage (notes, recents, view state)
                    │
              Eyeliner notes
                    │
        NotePersistence (revisioned queue, 300 ms debounce)
                    │
        Tauri invoke ──► Rust save_notes / export_notes_dialog ──► .rapture
```

| Location | Lines | Responsibility |
| --- | --- | --- |
| `src/App.tsx` | 1270 | Main controller: document loading, cache-or-index pipeline, search indexing, layout/zoom/rotation/scroll restoration, printing, keyboard shortcuts, all Eyeliner event handling |
| `src/components/Toolbar.tsx` | 531 | Top chrome: navigation, zoom, layout, theme, rotate, print, save, fullscreen, search, recent documents |
| `src/components/Sidebar.tsx` | 301 | Thumbnails, outline tree, search results |
| `src/components/NotesSidebar.tsx` | 303 | "Notes Deck", import/export, `NoteRow` editor |
| `src/components/Dropzone.tsx` | 206 | Landing page, file picker and drag-drop |
| `src/components/PdfPage.tsx` | 194 | Canvas render + PDF.js `TextLayer` + Eyeliner line overlay |
| `src/components/DocInfoModal.tsx` | 148 | Metadata dialog |
| `src/components/PdfThumbnail.tsx` | 141 | Deferred thumbnail canvas |
| `src/utils/db.ts` | 143 | IndexedDB (`rapture_db` v2: `pdf_store`, `pdf_cache`) |
| `src/utils/notePersistence.ts` | 63 | Ordered note write queue |
| `src/utils/tauri.ts` | 39 | Desktop detection + native bridge |
| `src/utils/samplePdf.ts` | 153 | In-memory sample PDF generator |
| `src/types.ts` | 59 | Shared types (`EyelinerNote`, `PdfCacheData`, …) |
| `src-tauri/src/lib.rs` | 212 | `save_notes`, `export_notes_dialog`, window-state persistence |
| `src-tauri/src/atomic_write.rs` | 45 | Same-directory temp file + `fsync` + rename |
| `vite.config.ts` | 89 | Build config + dev-only `/api/save-notes` HTTP endpoint |

**Rendering model.** Every page is a `PdfPage` with its own `IntersectionObserver` (`rootMargin: 200px`, `threshold: 0.1`). Offscreen pages render nothing; visible pages rasterize to a device-pixel-ratio-scaled canvas and mount a real PDF.js `TextLayer` (driven by CSS custom properties in `index.css`, which re-implements the `pdf_viewer.css` variable contract). This is **deferred rendering, not virtualization** — every page keeps a DOM container, and the hidden print container mounts *all* pages at once, so very large documents remain the main scaling risk.

**Caching.** First open of a document runs a full index: page-1 cover JPEG, per-page viewport sizes, resolved outline destinations, per-page extracted text, and metadata; the result is stored in `pdf_cache` keyed by filename, and subsequent opens skip straight to state hydration.

**Eyeliner mechanics.** Mousemove over the viewport hit-tests `[id^="pdf-page-container-"]` bounding boxes to find the hovered page and paints a non-interactive floating line (`pointer-events-none`, so scrolling is unaffected). Click converts the client Y into `yPercent = clamp((clientY - pageTop) / pageHeight, 0, 1)`. Lines render as absolutely positioned 2px divs at `top: {yPercent*100}%`. Move mode reuses the same click path to rewrite an existing note's `pageNumber`/`yPercent`. Keyboard shortcut `E` toggles the mode (suppressed while focus is in an input/textarea).

**Persistence contract.** `NotePersistence` is the strongest part of the codebase: `activate(name)` flushes before switching; `update()` bumps a revision, mirrors to `localStorage` synchronously, and schedules a debounced flush; `flush()` drains a serialized promise queue in a `while (pending)` loop taking a snapshot per iteration, so updates arriving during a slow write are never lost and **an emptied note list still writes `[]`** (which is what clears a stale sidecar). Desktop close is intercepted via `getCurrentWindow().onCloseRequested`, awaited, then `destroy()`ed; `beforeunload` covers the browser case. Failures keep the document open and surface a retry path.

## 4. Verification performed

| Check | Result |
| --- | --- |
| `npm run lint` (`tsc --noEmit`) | **Pass**, no diagnostics |
| `npm run test:notes` (5 tests) | **Pass** 5/5 — keystroke-at-close, serialized slow writes, empty-list write, failure/retry without queue poisoning, cross-document isolation, localStorage-failure-still-writes-disk |
| `npm run build` | **Blocked by environment, not by code.** esbuild's service spawn fails with `spawn EPERM` (named-pipe restriction of the confined shell). The checked-in `dist/` from the last successful build is present and self-consistent. |
| `cargo test` | Not run here; `atomic_write.rs` carries its own replacement/failure/cleanup unit test. |
| macOS runtime | **Not tested.** No Mac host available. |

## 5. Standing direction: cross-platform is a constraint, not a later feature

Project direction as of 26 September 2026, to be applied to **all future work** on Rapture:

- **Windows and macOS are co-equal targets.** New features, refactors, and fixes must be written platform-neutral on arrival. Do not introduce anything that only works on one platform, and do not add Windows-specific shortcuts with "port it later" as the plan.
- **The known macOS gaps below are deliberately deferred, not ignored.** They will be resolved together in a single dedicated pass, so that the platform-conditional work is designed and tested as one coherent change rather than accumulating scattered special cases. Until that pass, treat §5.1 as a known, accepted backlog.
- **Practical consequence for day-to-day changes:** when touching the Rust layer or anything filesystem-, path-, or OS-integration-related, prefer the platform-aware API (Tauri's path resolver, `PathBuf` joins, `cfg!(target_os)`) over environment variables or hardcoded separators even before the deferred pass lands. This keeps the eventual macOS pass a targeted change to a handful of functions instead of an archaeology exercise.
- **Keep a testable seam for the fix.** The deferred work is only cheap if platform-dependent logic stays confined to the few functions listed in §5.1 rather than spreading through the frontend; the frontend should continue to contain no OS branching beyond `isTauri()` feature detection.

## 5. macOS compatibility assessment

**Verdict: the architecture is portable and the frontend is nearly platform-neutral, but the native layer is Windows-only and would fail or silently misbehave on macOS today. This is a bounded, specific fix list — not a rewrite.**

### 5.1 Blocking issues (native layer)

1. **`APPDATA` is read directly and allowed to silently become empty.** `window_state_path()` and `app_root()` in `src-tauri/src/lib.rs` both do `std::env::var("APPDATA").unwrap_or_default()`. macOS does not define `APPDATA`, so this yields the *empty string* and the paths degrade to the relative `Rapture/window_state.json`, `Rapture/Notes/` — resolved against the process working directory, which for a bundled `.app` launched from Finder is `/`. Window geometry would silently stop persisting and notes would be written to an unpredictable (and likely unwritable) location. **Fix:** use Tauri's platform-aware resolver (`app.path().app_data_dir()` / `app_config_dir()`), which already returns `~/Library/Application Support/<identifier>` on macOS and `%APPDATA%\<identifier>` on Windows, plus a one-time migration of existing Windows files.
2. **The debug-build project-root heuristic is depth- and platform-dependent.** `app_root()` walks up exactly three parents from `current_exe()` with the comment `src-tauri/target/debug → project root`. On macOS the trajectory is `target/debug/rapture` (not `target/debug/rapture.exe`) and the bundle/arch layout can differ, so the walk-up can land on the wrong directory. `cfg!(debug_assertions)` is also the wrong switch for "developer mode" — a release build run from a checkout gets production paths. **Fix:** gate on an explicit env var (e.g. `RAPTURE_DEV_ROOT`) rather than parsing the executable path.
3. **`Notes` vs `notes` — a case-sensitivity fault line.** Rust writes autosaves to `Rapture/Notes/`, while the Vite dev middleware writes to the project's `notes/`. These are the same directory on Windows and **two different directories on case-sensitive macOS/Linux filesystems**. Standardize on one casing, and decide whether release autosaves and dev autosaves are meant to be the same store at all.
4. **Non-ASCII (e.g. Chinese) filenames are mangled into collision-prone names.** `safe_name()` maps any character outside `[A-Za-z0-9 .()_-]` to `_`. A file named `有机化学.pdf` becomes `______.pdf`, and two different CJK-named documents collide on the same sidecar. This is a live portability bug for the stated "apply notes to any PDF" goal, independent of macOS. The same regex is duplicated in `vite.config.ts`, so the two sides can drift. Note `notes\_1_________ ___.pdf.rapture` in the tree is exactly this failure already realized on Windows.
5. **No macOS packaging or OS integration.** `bundle.targets: "all"` means *all bundle types for the host OS*, so this builds NSIS/MSI on Windows and `.app`/`.dmg` on macOS — it does **not** cross-compile. `icon.icns` already exists, but there is no macOS signing/notarization configuration, no hardened-runtime entitlements, no universal (arm64 + x86_64) target selection, and no file-association or `RunEvent::Opened` handling — so double-clicking a `.pdf` or `.rapture` in Finder will not open it in Rapture.
6. **`rapture.bat` hardcodes a cmd.exe workflow.** Harmless but the documented entry point is Windows-only; portable `npm run desktop:dev` should be the primary instruction.

### 5.2 WebKit / Safari issues (Tauri uses system WKWebView on macOS)

7. **Offline-first is violated by the stylesheet.** `src/index.css` line 1 `@import`s Inter, Space Grotesk, and JetBrains Mono from `fonts.googleapis.com`, and `index.html` has no font preconnect or local fallback strategy tuned for it. On a genuinely offline machine (the app's entire premise) this either blocks or falls back to system fonts, and it is the one remaining network request in the product. **Fix:** self-host the three families as WOFF2 and drop the remote import.
8. **The Notes Deck editor has no `field-sizing` fallback.** `NoteRow` sets `fieldSizing: 'content'` inline alongside `rows={1}` and `overflow-hidden`. WebKit gained `field-sizing` only recently (Safari 26.2); on older WKWebView versions the property is ignored and the `overflow-hidden` one-row textarea **clips multiline notes** — a data-visibility problem in the app's core feature. **Fix:** an `@supports not (field-sizing: content)` rule that restores `overflow: auto` plus a scroll-height autosize.
9. **PDF.js auxiliary assets are unconfigured.** `getDocument` is called with only `{ data: buffer }` — no `cMapUrl`/`cMapPacked`, no `standardFontDataUrl`, no WASM/ICC paths. CJK and other CID-keyed PDFs (exactly the class most likely to have mangled filenames per issue 4) depend on CMap data to extract text and render correctly offline. Currently only the worker is explicitly bundled. **Fix:** ship `cmaps/` and `standard_fonts/` as Vite static assets and point PDF.js at them; then verify with a diverse offline corpus.
10. **Unverified WebKit surface area.** Fullscreen (`document.requestFullscreen`), `beforeunload` prompting, drag-and-drop `File` handling, `window.print()` (Rapture's print path renders the whole document into a hidden container and waits a fixed 1500 ms), `canvas.toDataURL` cover capture, and `devicePixelRatio` canvas scaling all need a real-Mac pass. The `beforeunload` return-value prompt in particular is not honored identically across browsers.

### 5.3 Cross-platform correctness that is already right

Worth recording so it is not "fixed" by mistake: `atomic_write` stages its temp file **in the destination directory** and then renames (same-filesystem atomicity), so it is correct on APFS and every other POSIX filesystem; Rust's `fs::rename` already exhibits the desired overwrite semantics on Unix; the logical-vs-physical pixel conversion for window state is DPI-correct; `safe_name` caps length at 200 characters (under macOS's 255-byte limit for the ASCII cases it produces); and the frontend contains **no** `process.platform` / `navigator.platform` branching beyond the `isTauri()` feature detection, so no frontend code needs rewriting for macOS.

## 6. Priorities before adding features

Ordered by risk-to-effort, independent of platform:

1. **Platform paths and filename fidelity (blocking macOS):** adopt Tauri's path resolver in `lib.rs`; unify `Notes`/`notes`; replace the character-whitelist sanitiser with a scheme that preserves Unicode and disambiguates collisions (e.g. a short hash suffix), shared by Rust and the Vite middleware instead of duplicated.
2. **Decouple document identity from filename.** Today `pdf_store`, `pdf_cache`, `rapture_eyeliner_<name>`, `rapture_pdf_state_<name>`, and the sidecar filename are all keyed by `fileName`, so two same-named PDFs collide across every layer. Use a stable document ID (content hash or UUID) internally while keeping `.rapture` import unrestricted.
3. **Fix the missing-document fallback.** `handleLoadRecent` loads *sample* content under the original filename when IndexedDB has no bytes — silently presenting the wrong document, and then persisting notes against the impersonated name. Replace with an explicit "file unavailable, re-select it" state.
4. **Tighten `.rapture` validation.** Import checks `type`, array-ness, `id`, and numeric `pageNumber` — but not `version`, `Number.isFinite(yPercent)`, the 0–1 range, or page bounds against the loaded document. Out-of-range imports are accepted and become unreachable lines.
5. **Bundle fonts and PDF.js auxiliary assets, then test offline on a clean machine** (and on a Mac).
6. **Reduce maintenance coupling.** `App.tsx` at 1270 lines holds document lifecycle, search, layout, scroll restoration, printing, keyboard handling, and all Eyeliner logic. Extracting hooks (`usePdfDocument`, `useReaderState`, `useEyeliner`) would make the next feature round cheaper and testable. The `.rapture` envelope is likewise written in four places (`lib.rs` ×2, `vite.config.ts`, `NotesSidebar.tsx`) with no single source of truth.
7. **Housekeeping:** stale `dist/` output (~890 kB main JS + 1.26 MB worker, with a Vite large-chunk warning); no size budget; the sample-PDF tutorial text advertises pinch-zoom and per-page rotation that do not exist; the footer hardcodes a "1024 x 768 Viewport" label; `metadata.json` and `assets/.aistudio/` are AI Studio residue with no runtime role.

## 7. Suggested macOS validation sequence

1. `cargo build` on macOS to confirm the native layer compiles under WKWebView's target and that no Windows-only API slipped in.
2. Apply §5.1 items 1–3, then verify `~/Library/Application Support/com.rapture.pdf-reader/` receives notes and `window_state.json` survives a restart.
3. Self-host fonts (§5.2 item 7) and disable networking, then confirm the UI renders and PDFs open with the network stack fully off.
4. Exercise the WebKit surface list in §5.2 item 10 on the oldest WKWebView version you intend to support.
5. Build a signed, notarized universal `.dmg` and add file associations.
