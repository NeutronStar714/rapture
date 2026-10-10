// Entry point for the PDF.js worker thread. The engine shims must run in this scope too,
// because a worker does not share the page's globals.
import './enginePolyfills.ts';
import 'pdfjs-dist/build/pdf.worker.min.mjs';
