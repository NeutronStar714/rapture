import React, { useState, useEffect, useCallback, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

import { createSamplePDF } from './utils/samplePdf';
import { LayoutMode, ReadingTheme, OutlineItem, SearchMatch, PageSize, PdfMetadata, RecentPdf, EyelinerNote } from './types';
import { savePdfToDb, getPdfFromDb, savePdfCacheToDb, getPdfCacheFromDb, deletePdfFromDb } from './utils/db';
import { tauriSaveNotes, isTauri } from './utils/tauri';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { NotePersistence } from './utils/notePersistence';

// Sub-components
import Toolbar from './components/Toolbar';
import Sidebar from './components/Sidebar';
import NotesSidebar from './components/NotesSidebar';
import Dropzone from './components/Dropzone';
import PdfPage from './components/PdfPage';
import DocInfoModal from './components/DocInfoModal';
import { Loader2, AlertCircle } from 'lucide-react';

// Set up the local worker for fully offline parsing
// The worker is created here rather than from a URL so that pdfWorker.ts can load the engine
// shims before PDF.js starts in that thread.
pdfjsLib.GlobalWorkerOptions.workerPort = new Worker(new URL('./utils/pdfWorker.ts', import.meta.url), { type: 'module' });

// Helper to recursively parse outline bookmarks to custom structure
const resolveOutline = async (pdfDoc: pdfjsLib.PDFDocumentProxy, items: any[]): Promise<OutlineItem[]> => {
  const result: OutlineItem[] = [];
  for (const item of items) {
    let pageNum = 1;
    if (item.dest) {
      try {
        let dest = item.dest;
        if (typeof dest === 'string') {
          dest = await pdfDoc.getDestination(dest);
        }
        if (Array.isArray(dest) && dest.length > 0) {
          const pageRef = dest[0];
          if (pageRef && typeof pageRef === 'object') {
            const pageIndex = await pdfDoc.getPageIndex(pageRef);
            pageNum = pageIndex + 1;
          }
        }
      } catch (err) {
        console.warn('Failed to resolve bookmark destination:', err);
      }
    }
    const children = item.items && item.items.length > 0
      ? await resolveOutline(pdfDoc, item.items)
      : undefined;

    result.push({
      title: item.title,
      pageNumber: pageNum,
      items: children,
    });
  }
  return result;
};

/** Save notes to local filesystem — Tauri (Rust) or Vite middleware */
async function saveNotesToFile(fileName: string, notes: EyelinerNote[]) {
  const saved = await tauriSaveNotes(fileName, notes);
  if (saved !== null) return;
  const response = await fetch('/api/save-notes', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileName, notes }),
  });
  if (!response.ok) throw new Error('Could not save notes (' + response.status + '). Please retry or export them.');
}

export default function App() {
  // Navigation & Zoom / Memory refs
  const zoomAnchorRef = useRef<{ ratio: number; oldZoom: number; newZoom: number } | null>(null);
  const pendingScrollRestoreRef = useRef<{ scrollTop?: number; scrollLeft?: number; scrollRatio: number; timestamp: number } | null>(null);
  const pdfViewportRef = useRef<HTMLDivElement>(null);
  const layoutChangePageRef = useRef<number>(1);
  const layoutChangePendingRef = useRef(false);

  // Document state
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [fileBuffer, setFileBuffer] = useState<ArrayBuffer | null>(null);
  
  // UI preferences
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [zoom, setZoom] = useState<number>(1.0);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('single-scroll');
  const [theme, setTheme] = useState<ReadingTheme>('light');
  const [rotation, setRotation] = useState<number>(0);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [notesSidebarOpen, setNotesSidebarOpen] = useState<boolean>(false);
  const [revisionMode, setRevisionMode] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState<boolean>(false);
  const [isPrinting, setIsPrinting] = useState<boolean>(false);

  // Eyeliner state
  const [eyelinerActive, setEyelinerActive] = useState(false);
  const [eyelinerNotes, renderNotes] = useState<EyelinerNote[]>([]);
  const [noteSaveError, setNoteSaveError] = useState<string | null>(null);
  const [notePersistence] = useState(() => new NotePersistence(saveNotesToFile, localStorage, renderNotes, setNoteSaveError));
  const setEyelinerNotes = useCallback((value: EyelinerNote[] | ((notes: EyelinerNote[]) => EyelinerNote[])) => notePersistence.update(value), [notePersistence]);
  const [floatingLinePage, setFloatingLinePage] = useState<number | null>(null);
  const [floatingLineY, setFloatingLineY] = useState<number | null>(null);
  const [moveNoteId, setMoveNoteId] = useState<string | null>(null);

  // Keep latest state values in a Ref so our scroll listener never has to unmount
  const stateRef = useRef({ zoom, layoutMode, rotation, currentPage, fileName });
  useEffect(() => {
    stateRef.current = { zoom, layoutMode, rotation, currentPage, fileName };
  }, [zoom, layoutMode, rotation, currentPage, fileName]);

  // Loading/parsing state
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  // Cached data for features
  const [pageSizes, setPageSizes] = useState<PageSize[]>([]);
  const [outline, setOutline] = useState<OutlineItem[]>([]);
  const [textByPage, setTextByPage] = useState<{ [pageNum: number]: string }>({});
  const [metadata, setMetadata] = useState<PdfMetadata | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<SearchMatch[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);

  // Recent PDFs state
  const [recentPdfs, setRecentPdfs] = useState<RecentPdf[]>(() => {
    const saved = localStorage.getItem('rapture_recent_pdfs');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      } catch (e) {
        console.error(e);
      }
    }
    return [
      { name: 'Document_Architecture.pdf', subText: 'System Blueprint Matrix', openedAt: Date.now() - 10000 },
      { name: 'Compatibility_Guide.pdf', subText: 'System Performance Guide', openedAt: Date.now() - 20000 },
      { name: 'Q4_Financial_Report.pdf', subText: 'Statistical Analysis Matrix', openedAt: Date.now() - 30000 }
    ];
  });

  // Watch native Escape or fullscreen events to sync fullscreen state
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Skip when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const cur = stateRef.current;

      // E — toggle Eyeliner
      if (e.key === 'e' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setEyelinerActive(prev => !prev);
        setMoveNoteId(null);
        setFloatingLinePage(null);
        setFloatingLineY(null);
        return;
      }

      // Ctrl + / Ctrl = — zoom in 10%
      if ((e.key === '+' || e.key === '=') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleZoomChange(Math.min(3, cur.zoom + 0.1));
        return;
      }

      // Ctrl - — zoom out 10%
      if (e.key === '-' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleZoomChange(Math.max(0.5, cur.zoom - 0.1));
        return;
      }
    };

    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    let closing = false;
    if (isTauri()) {
      getCurrentWindow().onCloseRequested(async event => {
        event.preventDefault();
        if (closing) return;
        closing = true;
        try {
          await notePersistence.flush();
          await getCurrentWindow().destroy();
        } catch (error) { setNoteSaveError(String(error)); }
        finally { closing = false; }
      }).then(stop => { if (disposed) stop(); else unlisten = stop; })
        .catch(error => setNoteSaveError('Close protection could not start: ' + String(error)));
    }
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (notePersistence.pending) {
        void notePersistence.flush().catch(() => {});
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => { disposed = true; unlisten?.(); window.removeEventListener('beforeunload', beforeUnload); };
  }, [notePersistence]);

  // PDF Loader Core
  const loadPdf = async (data: Uint8Array | ArrayBuffer, name: string) => {
    setIsLoading(true);
    setPdfError(null);
    setSearchQuery('');
    setSearchResults([]);
    setRotation(0);
    
    try {
      const buffer = data instanceof ArrayBuffer ? data : data.buffer;
      const loadingTask = pdfjsLib.getDocument({ data: buffer });
      const pdf = await loadingTask.promise;
      
      await notePersistence.activate(name);
      setPdfDoc(pdf);
      setFileName(name);
      setFileBuffer(buffer);
      setCurrentPage(1);

      // Check if we have cached parsing results for this PDF
      let cached = await getPdfCacheFromDb(name);
      
      let coverUrl = '';
      let sizes: PageSize[] = [];
      let resolvedOutline: OutlineItem[] = [];
      let texts: { [pageNum: number]: string } = {};
      let resolvedMetadata: PdfMetadata | null = null;

      if (cached) {
        sizes = cached.pageSizes;
        resolvedOutline = cached.outline;
        texts = cached.textByPage;
        resolvedMetadata = cached.metadata;
        if (cached.coverUrl) {
          coverUrl = cached.coverUrl;
        }

        setPageSizes(sizes);
        setOutline(resolvedOutline);
        setTextByPage(texts);
        setMetadata(resolvedMetadata);
      } else {
        // No cache: Extract cover image (Page 1)
        try {
          const firstPage = await pdf.getPage(1);
          const viewport = firstPage.getViewport({ scale: 0.5 });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const context = canvas.getContext('2d');
          if (context) {
            await firstPage.render({ canvasContext: context, viewport } as any).promise;
            coverUrl = canvas.toDataURL('image/jpeg', 0.8);
          }
        } catch (coverErr) {
          console.warn('Failed to render page 1 cover image:', coverErr);
        }

        // Extract page sizes/ratios
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 1 });
          sizes.push({ width: viewport.width, height: viewport.height });
        }
        setPageSizes(sizes);

        // Extract and resolve outline bookmarks
        try {
          const rawOutline = await pdf.getOutline();
          if (rawOutline && rawOutline.length > 0) {
            resolvedOutline = await resolveOutline(pdf, rawOutline);
          }
        } catch (err) {
          console.warn('Outline load error:', err);
        }
        setOutline(resolvedOutline);

        // Search text indexing page-by-page
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item: any) => (item as any).str).join(' ');
          texts[i] = pageText;
        }
        setTextByPage(texts);

        // Extract PDF details metadata
        try {
          const metadataResult = await pdf.getMetadata();
          const info = metadataResult.info as any;
          
          const formatDate = (pdfDateStr: string | undefined) => {
            if (!pdfDateStr) return 'N/A';
            if (pdfDateStr.startsWith('D:')) {
              const year = pdfDateStr.substring(2, 6);
              const month = pdfDateStr.substring(6, 8);
              const day = pdfDateStr.substring(8, 10);
              return `${year}-${month}-${day}`;
            }
            return pdfDateStr;
          };

          const sizeBytes = buffer.byteLength;
          let fileSizeStr = 'Unknown';
          if (sizeBytes > 0) {
            if (sizeBytes < 1024 * 1024) {
              fileSizeStr = `${(sizeBytes / 1024).toFixed(1)} KB`;
            } else {
              fileSizeStr = `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
            }
          }

          resolvedMetadata = {
            title: info?.Title,
            author: info?.Author,
            subject: info?.Subject,
            keywords: info?.Keywords,
            creator: info?.Creator,
            producer: info?.Producer,
            creationDate: formatDate(info?.CreationDate),
            modificationDate: formatDate(info?.ModDate),
            totalPages: pdf.numPages,
            pdfVersion: (metadataResult as any).metadata?.get('pdf:pdfversion') || '1.4',
            fileSize: fileSizeStr,
          };
        } catch (err) {
          resolvedMetadata = { totalPages: pdf.numPages };
        }
        setMetadata(resolvedMetadata);

        // Save extraction result to IndexedDB cache
        try {
          await savePdfCacheToDb(name, {
            pageSizes: sizes,
            outline: resolvedOutline,
            textByPage: texts,
            metadata: resolvedMetadata,
            coverUrl: coverUrl || undefined
          });
        } catch (cacheErr) {
          console.warn('Failed to save parsed cache to db:', cacheErr);
        }
      }

      // Add/update recent PDFs list
      setRecentPdfs((prev) => {
        const filtered = prev.filter((p) => p.name !== name);
        const subText = name === 'Rapture_Getting_Started_Guide.pdf' ? 'Getting Started Guide' : 'User Imported Document';
        
        // Retain previous coverUrl if cached or generated
        const prevCover = prev.find(p => p.name === name)?.coverUrl;
        const finalCover = coverUrl || prevCover || undefined;

        const updated = [
          { name, subText, openedAt: Date.now(), coverUrl: finalCover },
          ...filtered
        ];
        localStorage.setItem('rapture_recent_pdfs', JSON.stringify(updated));
        return updated;
      });

      // Try to restore saved view state
      const savedStateStr = localStorage.getItem(`rapture_pdf_state_${name}`);
      if (savedStateStr) {
        try {
          const savedState = JSON.parse(savedStateStr);
          if (savedState) {
            if (typeof savedState.zoom === 'number') setZoom(savedState.zoom);
            if (savedState.layoutMode) setLayoutMode(savedState.layoutMode);
            if (typeof savedState.rotation === 'number') setRotation(savedState.rotation);
            if (typeof savedState.currentPage === 'number') setCurrentPage(savedState.currentPage);
            
            if (typeof savedState.scrollRatio === 'number') {
              pendingScrollRestoreRef.current = {
                scrollTop: savedState.scrollTop,
                scrollLeft: savedState.scrollLeft,
                scrollRatio: savedState.scrollRatio,
                timestamp: Date.now()
              };
            }
          }
        } catch (e) {
          console.warn('Failed to parse saved pdf state:', e);
        }
      } else {
        // Reset to default
        setZoom(1.0);
        setLayoutMode('single-scroll');
        setRotation(0);
        setCurrentPage(1);
      }

    } catch (err: any) {
      console.error('Failed to parse PDF:', err);
      setPdfError(err?.message || 'Failed to open file. Please make sure it is a valid PDF.');
    } finally {
      setIsLoading(false);
    }
  };

  // Debounced deep text search execution
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    const delayDebounce = setTimeout(() => {
      const matches: SearchMatch[] = [];
      const queryLower = searchQuery.toLowerCase();

      Object.entries(textByPage).forEach(([pageNumStr, text]) => {
        const textStr = text as string;
        const pageNum = parseInt(pageNumStr, 10);
        const textLower = textStr.toLowerCase();

        let index = textLower.indexOf(queryLower);
        while (index !== -1) {
          const start = Math.max(0, index - 40);
          const end = Math.min(textStr.length, index + queryLower.length + 40);
          let snippet = textStr.substring(start, end);

          if (start > 0) snippet = '...' + snippet;
          if (end < textStr.length) snippet = snippet + '...';

          matches.push({
            pageNumber: pageNum,
            snippet,
            index,
          });

          index = textLower.indexOf(queryLower, index + 1);
        }
      });

      setSearchResults(matches);
      setIsSearching(false);
    }, 250);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery, textByPage]);

  // File Selector Callback
  const handleFileSelect = (file: File) => {
    const reader = new FileReader();
    reader.onload = async () => {
      if (reader.result instanceof ArrayBuffer) {
        try {
          await savePdfToDb(file.name, reader.result);
        } catch (dbErr) {
          console.error('Failed to save PDF to IndexedDB:', dbErr);
        }
        loadPdf(reader.result, file.name);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Sample PDF Loader Callback
  const handleLoadSample = () => {
    const sampleBytes = createSamplePDF();
    loadPdf(sampleBytes, 'Rapture_Getting_Started_Guide.pdf');
  };

  // Load a recent PDF
  const handleLoadRecent = async (pdf: RecentPdf) => {
    if (pdf.name === 'Rapture_Getting_Started_Guide.pdf') {
      handleLoadSample();
    } else {
      try {
        const savedBuffer = await getPdfFromDb(pdf.name);
        if (savedBuffer) {
          loadPdf(savedBuffer, pdf.name);
        } else {
          // If not found in IndexedDB (e.g. initial dummy ones or deleted), load sample bytes with that name
          const sampleBytes = createSamplePDF();
          loadPdf(sampleBytes, pdf.name);
        }
      } catch (err) {
        console.error('Failed to load recent PDF from DB:', err);
        const sampleBytes = createSamplePDF();
        loadPdf(sampleBytes, pdf.name);
      }
    }
  };

  // Page selection and scrolling action
  const handlePageChange = useCallback((pageNum: number) => {
    if (!pdfDoc || pageNum < 1 || pageNum > pdfDoc.numPages) return;
    setCurrentPage(pageNum);

    if (layoutMode === 'single-scroll' || layoutMode === 'double-scroll') {
      const element = document.getElementById(`pdf-page-container-${pageNum}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [pdfDoc, layoutMode]);

  // Scroll visibility sync callback (updates current page on scroll)
  const handlePageVisible = useCallback((pageNum: number) => {
    if (pendingScrollRestoreRef.current) return; // Ignore observer visibility events during active scroll restoration
    setCurrentPage((prev) => {
      if (prev === pageNum) return prev;
      return pageNum;
    });
  }, []);

  // Zoom scale modifier
  const handleZoomChange = (zoomValue: number) => {
    const container = document.getElementById('pdf-view-scroll-container');
    if (container) {
      const currentScrollTop = container.scrollTop;
      const currentScrollHeight = container.scrollHeight;
      const clientHeight = container.clientHeight;
      
      if (currentScrollHeight > 0) {
        const centerOffset = currentScrollTop + clientHeight / 2;
        const ratio = centerOffset / currentScrollHeight;
        
        zoomAnchorRef.current = {
          ratio,
          oldZoom: zoom,
          newZoom: zoomValue,
        };
      }
    }
    setZoom(zoomValue);
  };

  // Maintain vertical scroll center alignment when zoom factor changes
  useEffect(() => {
    if (zoomAnchorRef.current) {
      const anchor = zoomAnchorRef.current;
      zoomAnchorRef.current = null; // Clear to prevent double triggering
      
      const container = document.getElementById('pdf-view-scroll-container');
      if (container) {
        const targetScrollTop = anchor.ratio * container.scrollHeight - container.clientHeight / 2;
        container.scrollTop = Math.max(0, targetScrollTop);
      }
    }
  }, [zoom]);

  // After a layout-mode switch, scroll to the saved page and release the observer block
  useEffect(() => {
    if (!pdfDoc || !layoutChangePendingRef.current) return;
    layoutChangePendingRef.current = false;

    const pageToRestore = layoutChangePageRef.current;

    const timer = setTimeout(() => {
      const el = document.getElementById(`pdf-page-container-${pageToRestore}`);
      if (el) {
        el.scrollIntoView({ behavior: 'instant', block: 'center' });
      }
      setCurrentPage(pageToRestore);
      pendingScrollRestoreRef.current = null;
    }, 150);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutMode]);

  // Restore exact view position when a PDF is first loaded & all pages are sized
  useEffect(() => {
    if (!pdfDoc || pageSizes.length !== pdfDoc.numPages) return;
    if (!pendingScrollRestoreRef.current) return;
    // Skip if this is a layout-switch block (no scrollRatio data)
    if (pendingScrollRestoreRef.current.scrollRatio === 0 && pendingScrollRestoreRef.current.scrollTop === undefined) return;

    const restore = pendingScrollRestoreRef.current;
    let attempts = 0;
    const maxAttempts = 35; // 3.5 seconds total
    let lastScrollHeight = 0;
    let stableCount = 0;

    const intervalId = setInterval(() => {
      attempts++;
      const container = document.getElementById('pdf-view-scroll-container');
      if (container) {
        const currentScrollHeight = container.scrollHeight;

        if (currentScrollHeight > 100) {
          // Prioritize exact scrollTop coordinates as requested by user, fall back to ratio
          const targetScrollTop = typeof restore.scrollTop === 'number'
            ? restore.scrollTop
            : restore.scrollRatio * currentScrollHeight;

          container.scrollTop = targetScrollTop;
          if (typeof restore.scrollLeft === 'number') {
            container.scrollLeft = restore.scrollLeft;
          }

          const diff = Math.abs(container.scrollTop - targetScrollTop);
          if (currentScrollHeight === lastScrollHeight) {
            stableCount++;
          } else {
            stableCount = 0;
            lastScrollHeight = currentScrollHeight;
          }

          // Stop polling if we successfully set scrollTop, or height stabilized, or we hit max attempts
          if (diff < 5 || stableCount >= 3 || attempts >= maxAttempts) {
            clearInterval(intervalId);
            pendingScrollRestoreRef.current = null; // Mark restore as completely finished!
          }
        }
      }

      if (attempts >= maxAttempts) {
        clearInterval(intervalId);
        pendingScrollRestoreRef.current = null;
      }
    }, 100);

    return () => clearInterval(intervalId);
  }, [pdfDoc, pageSizes]);

  // Listen to scroll events to persist position state throttled to localStorage
  useEffect(() => {
    const container = document.getElementById('pdf-view-scroll-container');
    if (!container || !pdfDoc || !fileName) return;

    let timeoutId: any = null;

    const handleScroll = () => {
      // Don't overwrite if a restore is actively pending
      if (pendingScrollRestoreRef.current) return;

      if (timeoutId) return; // throttle

      timeoutId = setTimeout(() => {
        timeoutId = null;
        
        const scrollTop = container.scrollTop;
        const scrollHeight = container.scrollHeight;
        if (scrollHeight <= 0) return;

        const scrollRatio = scrollTop / scrollHeight;
        
        const current = stateRef.current;

        const state = {
          scrollRatio,
          scrollTop,
          scrollLeft: container.scrollLeft,
          zoom: current.zoom,
          layoutMode: current.layoutMode,
          rotation: current.rotation,
          currentPage: current.currentPage,
        };
        localStorage.setItem(`rapture_pdf_state_${fileName}`, JSON.stringify(state));
      }, 200); // reduced throttle to be even more responsive to scroll changes
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      container.removeEventListener('scroll', handleScroll);
    };
  }, [pdfDoc, fileName]);

  // Persistent coordinate save whenever the user unloads/leaves the view
  useEffect(() => {
    const saveStateOnLeave = () => {
      // Notes have their own awaited save lifecycle.
      const container = document.getElementById('pdf-view-scroll-container');
      if (!container || !pdfDoc || !fileName) return;

      const scrollTop = container.scrollTop;
      const scrollHeight = container.scrollHeight;
      if (scrollHeight <= 0) return;

      const scrollRatio = scrollTop / scrollHeight;
      const current = stateRef.current;

      const state = {
        scrollRatio,
        scrollTop,
        scrollLeft: container.scrollLeft,
        zoom: current.zoom,
        layoutMode: current.layoutMode,
        rotation: current.rotation,
        currentPage: current.currentPage,
      };
      localStorage.setItem(`rapture_pdf_state_${fileName}`, JSON.stringify(state));
    };

    window.addEventListener('beforeunload', saveStateOnLeave);
    return () => {
      saveStateOnLeave(); // Immediately update the coordinate value when component unmounts or leaves!
      window.removeEventListener('beforeunload', saveStateOnLeave);
    };
  }, [pdfDoc, fileName]);

  // Clear cached scroll position and restore default page state for troubleshooting
  const handleResetView = () => {
    if (!fileName) return;
    localStorage.removeItem(`rapture_pdf_state_${fileName}`);
    pendingScrollRestoreRef.current = null;
    setZoom(1.0);
    setRotation(0);
    setLayoutMode('single-scroll');
    setCurrentPage(1);
    
    // Smoothly scroll container back to top
    const container = document.getElementById('pdf-view-scroll-container');
    if (container) {
      container.scrollTop = 0;
      container.scrollLeft = 0;
    }
  };

  // Delete document from library completely
  const handleDeleteRecent = async (pdfToDelete: RecentPdf) => {
    try {
      // 1. Delete from IndexedDB (pdf binaries + cache entries)
      await deletePdfFromDb(pdfToDelete.name);
      
      // 2. Remove from recentPdfs state and localStorage
      setRecentPdfs((prev) => {
        const updated = prev.filter((p) => p.name !== pdfToDelete.name);
        localStorage.setItem('rapture_recent_pdfs', JSON.stringify(updated));
        return updated;
      });
      
      // 3. Clear from localStorage pdf states
      localStorage.removeItem(`rapture_pdf_state_${pdfToDelete.name}`);
      
      // 4. If the deleted PDF is currently opened, close it!
      if (fileName === pdfToDelete.name) {
        handleCloseFile();
      }
    } catch (err) {
      console.error('Failed to delete document from library:', err);
    }
  };

  // Layout preference modifier
  const handleLayoutChange = (mode: LayoutMode) => {
    layoutChangePageRef.current = currentPage;
    layoutChangePendingRef.current = true;
    pendingScrollRestoreRef.current = { scrollRatio: 0, timestamp: Date.now() };
    setLayoutMode(mode);
  };

  // Theme modifier
  const handleThemeChange = (newTheme: ReadingTheme) => {
    setTheme(newTheme);
  };

  // Rotation modifier (increments by 90 degrees)
  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  // Printing engine compiled client-side
  const handlePrint = () => {
    if (!pdfDoc) return;
    setIsPrinting(true);
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 1500); // allow canvas elements to load in hidden print-container before print dialog
  };

  // Document saving down to user filesystem
  const handleSave = () => {
    if (!fileBuffer) return;
    const blob = new Blob([fileBuffer], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName || 'document.pdf';
    link.click();
    URL.revokeObjectURL(url);
  };

  // Close active document and reset state to dropzone landing page
  const handleCloseFile = async () => {
    try { await notePersistence.activate(''); }
    catch (error) { setNoteSaveError(String(error)); return; }
    setPdfDoc(null);
    setFileName('');
    setFileBuffer(null);
    setCurrentPage(1);
    setOutline([]);
    setTextByPage({});
    setPageSizes([]);
    setMetadata(null);
    setSearchQuery('');
    setSearchResults([]);
  };

  // Eyeliner handlers
  const handleEyelinerToggle = useCallback(() => {
    setEyelinerActive(prev => !prev);
    setFloatingLinePage(null);
    setFloatingLineY(null);
    setMoveNoteId(null);
  }, []);

  const handleEyelinerMouseMove = useCallback((e: React.MouseEvent) => {
    if (!eyelinerActive) return;
    const parentEl = pdfViewportRef.current;
    if (!parentEl) return;

    const parentRect = parentEl.getBoundingClientRect();
    const yInParent = e.clientY - parentRect.top;

    const container = document.getElementById('pdf-view-scroll-container');
    if (!container) { setFloatingLinePage(null); setFloatingLineY(null); return; }

    // Find which page the mouse is over (check both X and Y bounds)
    const pageEls = container.querySelectorAll<HTMLElement>('[id^="pdf-page-container-"]');
    let foundPage: number | null = null;

    pageEls.forEach((el) => {
      const r = el.getBoundingClientRect();
      if (
        e.clientX >= r.left && e.clientX <= r.right &&
        e.clientY >= r.top && e.clientY <= r.bottom
      ) {
        const pageNum = parseInt(el.id.replace('pdf-page-container-', ''), 10);
        foundPage = pageNum;
      }
    });

    setFloatingLinePage(foundPage);
    setFloatingLineY(foundPage !== null ? yInParent : null);
  }, [eyelinerActive]);

  const handleEyelinerLeave = useCallback(() => {
    setFloatingLinePage(null);
    setFloatingLineY(null);
  }, []);

  const handleEyelinerClick = useCallback((e: React.MouseEvent) => {
    if (floatingLinePage === null) return;

    const pageEl = document.getElementById(`pdf-page-container-${floatingLinePage}`);
    if (!pageEl) return;

    const pageRect = pageEl.getBoundingClientRect();
    const yInPage = e.clientY - pageRect.top;
    const yPercent = Math.max(0, Math.min(1, yInPage / pageRect.height));

    if (moveNoteId) {
      // Move existing note
      setEyelinerNotes(prev =>
        prev.map(n => (n.id === moveNoteId ? { ...n, pageNumber: floatingLinePage, yPercent } : n)),
      );
      setMoveNoteId(null);
    } else {
      // Create new note
      const newNote: EyelinerNote = {
        id: `eyeliner-${Date.now()}`,
        pageNumber: floatingLinePage,
        yPercent,
        text: '',
        timestamp: Date.now(),
      };
      setEyelinerNotes(prev => [...prev, newNote]);
    }
  }, [floatingLinePage, moveNoteId]);

  const handleUpdateEyelinerNoteText = useCallback((id: string, text: string) => {
    setEyelinerNotes(prev => prev.map(n => n.id === id ? { ...n, text } : n));
  }, []);

  const handleDeleteEyelinerNote = useCallback((id: string) => {
    setEyelinerNotes(prev => prev.filter(n => n.id !== id));
  }, []);

  const handleStartMoveNote = useCallback((id: string) => {
    setMoveNoteId(prev => (prev === id ? null : id));
    setEyelinerActive(true);
    setFloatingLinePage(null);
    setFloatingLineY(null);
  }, []);

  const handleImportEyelinerNotes = useCallback((importedNotes: EyelinerNote[]) => {
    setEyelinerNotes(importedNotes);
  }, []);

  const handleScrollToEyelinerLine = useCallback((note: EyelinerNote) => {
    const pageEl = document.getElementById(`pdf-page-container-${note.pageNumber}`);
    const scrollContainer = document.getElementById('pdf-view-scroll-container');
    if (!pageEl || !scrollContainer) return;

    const pageOffsetTop = pageEl.offsetTop;
    const pageHeight = pageEl.offsetHeight;
    const containerHeight = scrollContainer.clientHeight;
    const targetScrollTop = pageOffsetTop + (pageHeight * note.yPercent) - (containerHeight / 2);

    scrollContainer.scrollTo({ top: Math.max(0, targetScrollTop), behavior: 'smooth' });
  }, []);

  // Revision-mode toggle
  const handleToggleRevision = useCallback(() => {
    setRevisionMode(prev => {
      const next = !prev;
      if (next) {
        setSidebarOpen(false);
        setNotesSidebarOpen(true);
      }
      return next;
    });
  }, []);

  // Fullscreen view modifier
  const handleToggleFullscreen = () => {
    const el = document.documentElement;
    if (!document.fullscreenElement) {
      el.requestFullscreen()
        .then(() => setIsFullscreen(true))
        .catch((err) => console.error('Failed to start presentation mode:', err));
    } else {
      document.exitFullscreen()
        .then(() => setIsFullscreen(false))
        .catch((err) => console.error('Failed to exit presentation mode:', err));
    }
  };

  // Group pages side-by-side for double page views
  const getPagePairs = () => {
    if (!pdfDoc) return [];
    const pairs: [number, number | null][] = [];
    for (let i = 1; i <= pdfDoc.numPages; i += 2) {
      pairs.push([i, i + 1 <= pdfDoc.numPages ? i + 1 : null]);
    }
    return pairs;
  };

  // Determine starting page of current side-by-side display slide
  const getDoublePageStart = () => {
    if (currentPage === 1) return 1;
    return currentPage % 2 === 0 ? currentPage - 1 : currentPage;
  };

  return (
    <div className={`flex flex-col h-screen overflow-hidden font-sans transition-colors duration-300 ${
      theme === 'dark' ? 'theme-dark bg-slate-950 text-slate-300' : 'bg-slate-100 text-slate-800'
    }`}>
      
      {noteSaveError && (
        <div role="alert" className="bg-red-50 text-red-800 px-4 py-2 text-sm flex items-center gap-3">
          <span>Notes save failed: {noteSaveError}</span>
          <button className="underline shrink-0" onClick={() => { void notePersistence.flush().catch(() => {}); }}>Retry save</button>
        </div>
      )}
      {/* 1. Header & Secondary Toolbar (Merged into Sleek design Component) */}
      {pdfDoc && (
        <Toolbar
          fileName={fileName}
          currentPage={currentPage}
          totalPages={pdfDoc.numPages}
          zoom={zoom}
          layoutMode={layoutMode}
          theme={theme}
          sidebarOpen={sidebarOpen}
          notesSidebarOpen={notesSidebarOpen}
          isFullscreen={isFullscreen}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          onToggleNotesSidebar={() => { setNotesSidebarOpen(!notesSidebarOpen); if (revisionMode) setRevisionMode(false); }}
          revisionMode={revisionMode}
          onToggleRevision={handleToggleRevision}
          onPageChange={handlePageChange}
          onZoomChange={handleZoomChange}
          onLayoutChange={handleLayoutChange}
          onThemeChange={handleThemeChange}
          onRotate={handleRotate}
          onPrint={handlePrint}
          onSave={handleSave}
          onShowInfo={() => setIsInfoModalOpen(true)}
          onCloseFile={handleCloseFile}
          onToggleFullscreen={handleToggleFullscreen}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onLoadSample={handleLoadSample}
          recentPdfs={recentPdfs}
          onLoadRecent={handleLoadRecent}
          onFileSelect={handleFileSelect}
          onResetView={handleResetView}
        />
      )}

      {/* 2. Primary Layout Deck */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Sidebar panels */}
        {pdfDoc && sidebarOpen && (
          <Sidebar
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            pdfDoc={pdfDoc}
            currentPage={currentPage}
            onPageClick={handlePageChange}
            pageSizes={pageSizes}
            outline={outline}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            searchResults={searchResults}
            isSearching={isSearching}
            overlay={revisionMode}
          />
        )}

        {/* Content Viewer viewport */}
        <div ref={pdfViewportRef} className="flex-1 overflow-hidden relative flex flex-col items-center justify-center">
          {isLoading && (
            <div className="absolute inset-0 bg-white/90 backdrop-blur-xs flex flex-col items-center justify-center gap-3 z-40">
              <Loader2 className="animate-spin text-[#AA262C]" size={36} />
              <p className="text-sm font-semibold text-slate-700">Assembling document layouts...</p>
              <p className="text-xs text-slate-400">Extracting outline & indexing searchable text offline</p>
            </div>
          )}

          {pdfError && (
            <div className="max-w-md p-6 bg-white border border-red-100 rounded-2xl shadow-xl text-center flex flex-col items-center gap-3">
              <AlertCircle size={44} className="text-red-500" />
              <h3 className="font-display font-semibold text-lg text-slate-800">Error Loading Document</h3>
              <p className="text-sm text-slate-500 leading-normal">{pdfError}</p>
              <button
                onClick={handleCloseFile}
                className="mt-2 rounded-xl bg-[#AA262C] text-white px-5 py-2 text-sm font-medium hover:bg-[#8b1e24] cursor-pointer transition-colors"
              >
                Go Back
              </button>
            </div>
          )}

          {!pdfDoc && !isLoading && !pdfError && (
            <Dropzone
              onFileSelect={handleFileSelect}
              onLoadSample={handleLoadSample}
              recentPdfs={recentPdfs}
              onLoadRecent={handleLoadRecent}
              onDeleteRecent={handleDeleteRecent}
            />
          )}

          {/* Active PDF Viewport wrapper */}
          {pdfDoc && !pdfError && (
            <div
              id="pdf-view-scroll-container"
              className={`flex-1 w-full overflow-auto p-8 select-text flex justify-start items-start relative pdf-theme-${theme}`}
              onMouseMove={handleEyelinerMouseMove}
              onClick={handleEyelinerClick}
              onMouseLeave={handleEyelinerLeave}
            >
              
              {/* LAYOUT RENDER SWITCHERS */}
              {layoutMode === 'single-page' && (
                <div className="my-auto mx-auto w-max max-w-full">
                  <PdfPage
                    pdfDoc={pdfDoc}
                    pageNumber={currentPage}
                    zoom={zoom}
                    rotation={rotation}
                    pageSize={pageSizes[currentPage - 1]}
                    searchQuery={searchQuery}
                    eyelinerLines={eyelinerNotes.filter(n => n.pageNumber === currentPage)}
                  />
                </div>
              )}

              {layoutMode === 'double-page' && (
                <div className="my-auto mx-auto flex gap-6 max-w-full">
                  {(() => {
                    const startPage = getDoublePageStart();
                    return (
                      <>
                        <PdfPage
                          pdfDoc={pdfDoc}
                          pageNumber={startPage}
                          zoom={zoom}
                          rotation={rotation}
                          pageSize={pageSizes[startPage - 1]}
                          searchQuery={searchQuery}
                          eyelinerLines={eyelinerNotes.filter(n => n.pageNumber === startPage)}
                        />
                        {startPage + 1 <= pdfDoc.numPages && (
                          <PdfPage
                            pdfDoc={pdfDoc}
                            pageNumber={startPage + 1}
                            zoom={zoom}
                            rotation={rotation}
                            pageSize={pageSizes[startPage]}
                            searchQuery={searchQuery}
                            eyelinerLines={eyelinerNotes.filter(n => n.pageNumber === startPage + 1)}
                          />
                        )}
                      </>
                    );
                  })()}
                </div>
              )}

              {layoutMode === 'single-scroll' && (
                <div className="space-y-8 flex flex-col items-center py-2 mx-auto">
                  {Array.from({ length: pdfDoc.numPages }).map((_, i) => {
                    const pageNum = i + 1;
                    return (
                      <PdfPage
                        key={`scroll-${pageNum}`}
                        pdfDoc={pdfDoc}
                        pageNumber={pageNum}
                        zoom={zoom}
                        rotation={rotation}
                        onVisible={handlePageVisible}
                        pageSize={pageSizes[i]}
                        searchQuery={searchQuery}
                        eyelinerLines={eyelinerNotes.filter(n => n.pageNumber === pageNum)}
                      />
                    );
                  })}
                </div>
              )}

              {layoutMode === 'double-scroll' && (
                <div className="space-y-8 flex flex-col items-center py-2 mx-auto">
                  {getPagePairs().map((pair, index) => (
                    <div key={`pair-${index}`} className="flex gap-6 max-w-full">
                      <PdfPage
                        pdfDoc={pdfDoc}
                        pageNumber={pair[0]}
                        zoom={zoom}
                        rotation={rotation}
                        onVisible={handlePageVisible}
                        pageSize={pageSizes[pair[0] - 1]}
                        searchQuery={searchQuery}
                        eyelinerLines={eyelinerNotes.filter(n => n.pageNumber === pair[0])}
                      />
                      {pair[1] && (
                        <PdfPage
                          pdfDoc={pdfDoc}
                          pageNumber={pair[1]}
                          zoom={zoom}
                          rotation={rotation}
                          onVisible={handlePageVisible}
                          pageSize={pageSizes[pair[1] - 1]}
                          searchQuery={searchQuery}
                          eyelinerLines={eyelinerNotes.filter(n => n.pageNumber === pair[1])}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Non-interactive floating red line (no overlay — scroll unaffected) */}
          {pdfDoc && eyelinerActive && floatingLinePage !== null && floatingLineY !== null && (
            <div
              className="absolute pointer-events-none z-50"
              style={{
                top: floatingLineY,
                left: 0,
                right: 0,
                height: '2px',
                backgroundColor: 'rgba(170, 38, 44, 0.5)',
                boxShadow: '0 0 4px rgba(170, 38, 44, 0.3)',
              }}
            />
          )}
        </div>

        {/* Right Sidebar / Revision Mode */}
        {pdfDoc && (notesSidebarOpen || revisionMode) && (
          <NotesSidebar
            isOpen={notesSidebarOpen || revisionMode}
            onClose={() => { setNotesSidebarOpen(false); setRevisionMode(false); }}
            fileName={fileName}
            currentPage={currentPage}
            eyelinerActive={eyelinerActive}
            eyelinerNotes={eyelinerNotes}
            moveNoteId={moveNoteId}
            revisionMode={revisionMode}
            onToggleEyeliner={handleEyelinerToggle}
            onUpdateNoteText={handleUpdateEyelinerNoteText}
            onDeleteNote={handleDeleteEyelinerNote}
            onScrollToLine={handleScrollToEyelinerLine}
            onStartMoveNote={handleStartMoveNote}
            onImportNotes={handleImportEyelinerNotes}
          />
        )}
      </div>

      {/* 3. Bottom Status Bar (Sleek Footer Height 6) */}
      {pdfDoc && (
        <footer className="h-6 bg-white border-t border-gray-200 flex items-center justify-between px-3 text-[10px] shrink-0 font-sans select-none relative">
          <div className="flex items-center gap-4 text-gray-500 font-medium uppercase tracking-tight">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              <span>Offline Mode Active</span>
            </div>
            <span className="text-gray-300">|</span>
            <span className="truncate max-w-[200px] sm:max-w-[300px]">{fileName}</span>
          </div>
          {/* Centered copyright */}
          <p className="absolute left-1/2 -translate-x-1/2 text-[10px] text-gray-400 font-sans select-none whitespace-nowrap">
            © 2026 NeutronStar714
          </p>
          <div className="flex items-center gap-4 text-gray-500">
            <span onClick={() => setIsInfoModalOpen(true)} className="hover:text-[#AA262C] cursor-pointer transition-colors font-semibold">User Guide & Document Details</span>
            <span className="text-gray-900 font-bold hidden sm:inline">1024 x 768 Viewport</span>
          </div>
        </footer>
      )}

      {/* 4. Invisible High-Res Printing Layout Container */}
      {isPrinting && pdfDoc && (
        <div id="print-container" className="hidden bg-white">
          {Array.from({ length: pdfDoc.numPages }).map((_, i) => {
            const pageNum = i + 1;
            return (
              <div key={`print-page-${pageNum}`} className="page-break-after-always my-4 p-4 flex justify-center bg-white">
                <PdfPage
                  pdfDoc={pdfDoc}
                  pageNumber={pageNum}
                  zoom={1.2}
                  rotation={rotation}
                  pageSize={pageSizes[i]}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* 5. Metadata Details Modal */}
      <DocInfoModal
        isOpen={isInfoModalOpen}
        onClose={() => setIsInfoModalOpen(false)}
        metadata={metadata}
        fileName={fileName}
      />

    </div>
  );
}
