/**
 * Generates a valid multi-page PDF file structure as a Uint8Array entirely in memory.
 * This PDF.js compatible document provides an out-of-the-box reading experience.
 */
export function createSamplePDF(): Uint8Array {
  const page1Text = [
    "BT",
    "/F1 28 Tf",
    "50 780 Td",
    "(RAPTURE PDF VIEWER) Tj",
    "/F1 14 Tf",
    "0 -40 Td",
    "(Welcome to Rapture - a professional, offline-first PDF reader.) Tj",
    "0 -25 Td",
    "(This application is built with React, Vite, and PDF.js to deliver) Tj",
    "0 -20 Td",
    "(extremely high performance rendering, custom sidebars, and fluid) Tj",
    "0 -20 Td",
    "(page layouts completely in your browser with zero network requests.) Tj",
    "0 -40 Td",
    "(Advanced Toolbar Features:) Tj",
    "0 -25 Td",
    "(* Layout Switchers: Single Page, Two Pages, Continuous Vertical, and Two-page continuous) Tj",
    "0 -20 Td",
    "(* Zoom Engine: Pinch, click, fit-width, fit-page, and increments from 50% to 300%) Tj",
    "0 -20 Td",
    "(* Dual Rotation: Rotate specific pages or the entire document clockwise/counterclockwise) Tj",
    "0 -20 Td",
    "(* High Contrast Themes: Day (Light), Night (Dark/Eye-save), and Sepia reading filters) Tj",
    "0 -40 Td",
    "(Interactive Sidebar Panels:) Tj",
    "0 -25 Td",
    "(* Page Thumbnails: Visual grids for instant visual jumping) Tj",
    "0 -20 Td",
    "(* Bookmarks & Outline: Expandable tree navigation (see Page 2 for document sections)) Tj",
    "0 -20 Td",
    "(* Deep Text Search: Enter terms on the search tab to instantly list occurrences and context) Tj",
    "ET"
  ].join("\n");

  const page2Text = [
    "BT",
    "/F1 24 Tf",
    "50 780 Td",
    "(CHAPTER 1: POWER LAYOUTS & THEMES) Tj",
    "/F1 14 Tf",
    "0 -40 Td",
    "(Single Page Scroll vs. Double Page Scroll) Tj",
    "0 -25 Td",
    "(Using the toolbar, you can swap between layouts depending on your content:) Tj",
    "0 -20 Td",
    "(- Single Page: Shows exactly one page inside the viewport, ideal for presentation) Tj",
    "0 -20 Td",
    "(- Two Pages: Shows pairs side-by-side (e.g. Page 2 and Page 3), mimicking physical books) Tj",
    "0 -20 Td",
    "(- Continuous Scroll (Single): Standard web view where pages are stacked vertically) Tj",
    "0 -20 Td",
    "(- Continuous Scroll (Two-Page): Highly requested feature for scanning pamphlets or comics) Tj",
    "0 -40 Td",
    "(Night Reading Filter (Inversion Engine)) Tj",
    "0 -25 Td",
    "(For night reading, toggle 'Night Theme' in the upper-right corner. It applies) Tj",
    "0 -20 Td",
    "(a custom rendering filter that inverts the white pages into comfortable dark slate) Tj",
    "0 -20 Td",
    "(without losing image quality or making diagrams unreadable.) Tj",
    "0 -20 Td",
    "(Try the 'Sepia Theme' for a soft, book-like paper glow during active study!) Tj",
    "0 -40 Td",
    "(Printing & Downloading) Tj",
    "0 -25 Td",
    "(Clicking the print button compiles all pages into high-fidelity render layouts) Tj",
    "0 -20 Td",
    "(ready for physical paper output. Clicking save downloads this exact document) Tj",
    "0 -20 Td",
    "(right back to your device, keeping your file workflow clean.) Tj",
    "ET"
  ].join("\n");

  const page3Text = [
    "BT",
    "/F1 24 Tf",
    "50 780 Td",
    "(CHAPTER 2: FULL TEXT SEARCH INDEXING) Tj",
    "/F1 14 Tf",
    "0 -40 Td",
    "(Browser-Side Search Processing) Tj",
    "0 -25 Td",
    "(Because Rapture is 100% serverless, search is performed entirely client-side:) Tj",
    "0 -20 Td",
    "(- Instant Indexing: When a document loads, Rapture parses the text objects) Tj",
    "0 -20 Td",
    "(- Snippet List: Entering a word like 'Rapture' or 'Theme' in the sidebar search tab) Tj",
    "0 -20 Td",
    "(  lists matches across all pages, with surrounding sentences for visual context.) Tj",
    "0 -20 Td",
    "(- Scroll-to-Jump: Click any search card, and Rapture immediately scrolls) Tj",
    "0 -20 Td",
    "(  the viewport to center that exact match.) Tj",
    "0 -40 Td",
    "(Full Privacy Guard) Tj",
    "0 -25 Td",
    "(No server. No trackers. No cloud uploading. All document processing occurs) Tj",
    "0 -20 Td",
    "(in sandbox memory. Drag-and-drop your company contracts, academic essays, or) Tj",
    "0 -20 Td",
    "(confidential financial books without fear. Your secrets never leave this tab.) Tj",
    "0 -40 Td",
    "(Getting Started:) Tj",
    "0 -25 Td",
    "(Click the top-left 'Open File' button to select a local PDF from your device,) Tj",
    "0 -20 Td",
    "(or drag and drop a PDF file directly onto the viewer. Let's start reading!) Tj",
    "ET"
  ].join("\n");

  const pdfParts: string[] = [];
  pdfParts.push("%PDF-1.4\n");
  pdfParts.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R /Outlines 10 0 R >>\nendobj\n");
  pdfParts.push("2 0 obj\n<< /Type /Pages /Kids [ 3 0 R 4 0 R 5 0 R ] /Count 3 >>\nendobj\n");
  
  // Page 1
  pdfParts.push(`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 6 0 R /Resources << /Font << /F1 9 0 R >> >> >>\nendobj\n`);
  // Page 2
  pdfParts.push(`4 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 7 0 R /Resources << /Font << /F1 9 0 R >> >> >>\nendobj\n`);
  // Page 3
  pdfParts.push(`5 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 8 0 R /Resources << /Font << /F1 9 0 R >> >> >>\nendobj\n`);

  // Content streams (explicitly matching lengths)
  pdfParts.push(`6 0 obj\n<< /Length ${page1Text.length} >>\nstream\n${page1Text}\nendstream\nendobj\n`);
  pdfParts.push(`7 0 obj\n<< /Length ${page2Text.length} >>\nstream\n${page2Text}\nendstream\nendobj\n`);
  pdfParts.push(`8 0 obj\n<< /Length ${page3Text.length} >>\nstream\n${page3Text}\nendstream\nendobj\n`);

  // Font object
  pdfParts.push("9 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n");

  // Outlines (Bookmarks) for Table of Contents!
  // This is a highly professional touch that builds a real interactive Outline in pdf.js
  pdfParts.push("10 0 obj\n<< /Type /Outlines /First 11 0 R /Last 12 0 R /Count 2 >>\nendobj\n");
  pdfParts.push("11 0 obj\n<< /Title (Chapter 1: Power Layouts & Themes) /Parent 10 0 R /Next 12 0 R /Dest [ 4 0 R /Fit ] >>\nendobj\n");
  pdfParts.push("12 0 obj\n<< /Title (Chapter 2: Full Text Search Indexing) /Parent 10 0 R /Prev 11 0 R /Dest [ 5 0 R /Fit ] >>\nendobj\n");

  // Trailer + xref offsets (PDF.js automatically handles approximate/reconstructed xref)
  pdfParts.push("xref\n0 13\n0000000000 65535 f\n");
  pdfParts.push("trailer\n<< /Size 13 /Root 1 0 R >>\nstartxref\n100\n%%EOF");

  const pdfStr = pdfParts.join("");
  const bytes = new Uint8Array(pdfStr.length);
  for (let i = 0; i < pdfStr.length; i++) {
    bytes[i] = pdfStr.charCodeAt(i) & 0xff;
  }
  return bytes;
}
