/**
 * PDF.js needs auxiliary data files at runtime: CMaps for CJK and other CID-keyed fonts, the 14
 * standard fonts for PDFs that do not embed theirs, WebAssembly decoders for JPEG 2000 images,
 * and ICC colour profiles. PDF.js 6 ships them but has no default location, so without these
 * options such documents render wrong or fail. The Vite config copies the folders listed here
 * from the pdfjs-dist package to `<base><dir>/`, in development and in the built app alike.
 */

/** Folder the asset folders are served under, absolute so it resolves from any page URL. */
export const PDFJS_ASSET_BASE = '/pdfjs/';

/** Folder names inside the pdfjs-dist package, copied verbatim. */
export const PDFJS_ASSET_DIRS = ['cmaps', 'standard_fonts', 'wasm', 'iccs'] as const;

/** Spread into every `getDocument()` call. */
export const PDFJS_ASSET_OPTIONS = {
  cMapUrl: `${PDFJS_ASSET_BASE}cmaps/`,
  cMapPacked: true,
  standardFontDataUrl: `${PDFJS_ASSET_BASE}standard_fonts/`,
  wasmUrl: `${PDFJS_ASSET_BASE}wasm/`,
  iccUrl: `${PDFJS_ASSET_BASE}iccs/`,
} as const;
