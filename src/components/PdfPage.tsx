import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { Loader2, AlertCircle } from 'lucide-react';
import { PageSize, EyelinerNote } from '../types';

interface PdfPageProps {
  pdfDoc: pdfjsLib.PDFDocumentProxy;
  pageNumber: number;
  zoom: number;
  rotation: number;
  onVisible?: (pageNum: number) => void;
  pageSize?: PageSize;
  key?: string | number;
  searchQuery?: string;
  eyelinerLines?: EyelinerNote[];
}

export default function PdfPage({
  pdfDoc,
  pageNumber,
  zoom,
  rotation,
  onVisible,
  pageSize = { width: 595, height: 842 },
  searchQuery = '',
  eyelinerLines = [],
}: PdfPageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const textLayerCancelRef = useRef<(() => void) | null>(null);

  const [renderStatus, setRenderStatus] = useState<'idle' | 'rendering' | 'success' | 'error'>('idle');
  const [isInViewport, setIsInViewport] = useState(false);

  const activeRenderTask = useRef<any>(null);

  /* ── IntersectionObserver ── */
  useEffect(() => {
    const sc = document.getElementById('pdf-view-scroll-container');
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setIsInViewport(true);
            onVisible?.(pageNumber);
          } else setIsInViewport(false);
        }
      },
      { root: sc, rootMargin: '200px 0px 200px 0px', threshold: 0.1 },
    );
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, [pageNumber, onVisible]);

  /* ── Main render ── */
  useEffect(() => {
    let isCurrent = true;
    async function renderPage() {
      if (!isInViewport || !pdfDoc) return;
      setRenderStatus('rendering');

      try {
        const page = await pdfDoc.getPage(pageNumber);
        if (!isCurrent) return;

        const vp = page.getViewport({ scale: zoom, rotation });

        // ── Canvas ──
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        if (activeRenderTask.current) try { activeRenderTask.current.cancel(); } catch {}

        const pr = window.devicePixelRatio || 1;
        canvas.width = vp.width * pr;
        canvas.height = vp.height * pr;
        canvas.style.width = `${vp.width}px`;
        canvas.style.height = `${vp.height}px`;
        ctx.resetTransform();
        ctx.scale(pr, pr);

        const renderTask = page.render({ canvasContext: ctx, viewport: vp } as any);
        activeRenderTask.current = renderTask;
        await renderTask.promise;
        if (!isCurrent) return;

        // ── pdfjs-dist built-in TextLayer ──
        textLayerCancelRef.current?.();
        textLayerCancelRef.current = null;
        if (textLayerRef.current) textLayerRef.current.innerHTML = '';

        const textContent = await page.getTextContent();
        if (!isCurrent) return;

        if (textLayerRef.current) {
          textLayerRef.current.style.setProperty('--total-scale-factor', String(zoom));
          const tl = new pdfjsLib.TextLayer({
            textContentSource: textContent,
            container: textLayerRef.current,
            viewport: vp,
          });
          if (textLayerRef.current) {
            textLayerRef.current.style.width = '';
            textLayerRef.current.style.height = '';
          }
          textLayerCancelRef.current = () => tl.cancel();
          await tl.render();
        }

        setRenderStatus('success');
      } catch (err: any) {
        if (err?.name !== 'RenderingCancelledException' && isCurrent) setRenderStatus('error');
      }
    }
    renderPage();

    return () => {
      isCurrent = false;
      if (activeRenderTask.current) try { activeRenderTask.current.cancel(); } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfDoc, pageNumber, zoom, rotation, isInViewport]);

  const isRotated = rotation % 180 !== 0;
  const cw = (isRotated ? pageSize.height : pageSize.width) * zoom;
  const ch = (isRotated ? pageSize.width : pageSize.height) * zoom;

  return (
    <div
      ref={containerRef}
      style={{ width: `${cw}px`, height: `${ch}px` }}
      id={`pdf-page-container-${pageNumber}`}
      className="relative mx-auto rounded-lg shadow-lg bg-white border border-slate-200/60 overflow-hidden transition-shadow duration-300 hover:shadow-xl flex items-center justify-center print:shadow-none print:border-none print:rounded-none"
    >
      {/* PDF page image */}
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 pointer-events-none transition-opacity duration-300 ${
          renderStatus === 'success' ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* PDF.js TextLayer — selectable text with native blue ::selection */}
      <div
        ref={textLayerRef}
        className="rapture-text-layer absolute inset-0 z-10"
      />

      {/* Loading */}
      {renderStatus !== 'success' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50/90 text-slate-400 gap-2 pointer-events-none">
          {renderStatus === 'rendering' ? (
            <>
              <Loader2 className="animate-spin text-[#AA262C]" size={24} />
              <span className="text-xs font-medium text-slate-500 font-mono">Page {pageNumber}</span>
            </>
          ) : renderStatus === 'error' ? (
            <>
              <AlertCircle size={24} className="text-red-500" />
              <span className="text-xs font-semibold text-red-500">Failed to render</span>
              <span className="text-[10px] text-slate-400">Page {pageNumber}</span>
            </>
          ) : (
            <>
              <span className="text-xs font-medium font-mono text-slate-400">Page {pageNumber}</span>
              <span className="text-[10px] text-slate-300">Ready</span>
            </>
          )}
        </div>
      )}

      {/* Page number */}
      <div className="absolute bottom-2 right-2 bg-slate-900/40 text-[9px] text-white px-1.5 py-0.5 rounded-md font-mono select-none backdrop-blur-xs print:hidden opacity-0 hover:opacity-100 transition-opacity duration-200 pointer-events-none">
        p. {pageNumber}
      </div>

      {/* Eyeliner lines */}
      {eyelinerLines.map((note) => (
        <div
          key={note.id}
          className="absolute left-0 right-0 z-20 pointer-events-none"
          style={{
            top: `${(note.yPercent * 100).toFixed(2)}%`,
            height: '2px',
            backgroundColor: 'rgba(170, 38, 44, 0.5)',
          }}
        />
      ))}
    </div>
  );
}
