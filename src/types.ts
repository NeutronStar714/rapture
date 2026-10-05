export type LayoutMode = 'single-page' | 'double-page' | 'single-scroll' | 'double-scroll';


export type ReadingTheme = 'light' | 'dark' | 'sepia';

export interface SearchMatch {
  pageNumber: number;
  snippet: string;
  index: number;
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
  subText: string;
  openedAt: number;
  coverUrl?: string;
}

export interface EyelinerNote {
  id: string;
  pageNumber: number;
  yPercent: number; // 0–1, vertical position within the page
  text: string;
  timestamp: number;
}

export interface PdfCacheData {
  pageSizes: PageSize[];
  outline: OutlineItem[];
  textByPage: { [pageNum: number]: string };
  metadata: PdfMetadata | null;
  coverUrl?: string;
}
