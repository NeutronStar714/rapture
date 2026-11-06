export type LayoutMode = 'single-page' | 'double-page' | 'single-scroll' | 'double-scroll';


export type ReadingTheme = 'light' | 'dark' | 'sepia';

export interface SearchMatch {
  pageNumber: number;
  snippet: string;
  index: number;
  snippetMatchStart: number;
  snippetMatchEnd: number;
}

export interface OutlineItem {
  title: string;
  pageNumber: number;
  items?: OutlineItem[];
}

export interface PdfMetadata {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string;
  creator?: string;
  producer?: string;
  creationDate?: string;
  modificationDate?: string;
  fileSize?: string;
  pageSize?: string;
  totalPages: number;
  pdfVersion?: string;
}

export interface PageSize {
  width: number;
  height: number;
}

export interface RecentPdf {
  name: string;
  kind?: 'pdf' | 'epub';
  subText: string;
  openedAt: number;
  coverUrl?: string;
  coverText?: string;
}

export interface EyelinerNote {
  id: string;
  pageNumber: number;
  yPercent: number; // 0–1, PDF page height or EPUB chapter text progress
  text: string;
  timestamp: number;
  // Offsets index the PDF.js text layer or the EPUB chapter text.
  highlight?: TextHighlight;
  // Present for EPUB notes; pageNumber identifies the chapter and this offset anchors its text.
  epubOffset?: number;
}

export interface TextHighlight {
  start: number;
  end: number;
}

export interface PdfCacheData {
  pageSizes: PageSize[];
  outline: OutlineItem[];
  textByPage: { [pageNum: number]: string };
  metadata: PdfMetadata | null;
  coverUrl?: string;
}
