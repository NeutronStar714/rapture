import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { Loader2 } from 'lucide-react';
import { PageSize } from '../types';

interface PdfThumbnailProps {
  pdfDoc: pdfjsLib.PDFDocumentProxy;
  pageNumber: number;
  isActive: boolean;
  onClick: () => void;
  pageSize?: PageSize;
  key?: string | number;
}

export default function PdfThumbnail({
  pdfDoc,
  pageNumber,
  isActive,
  onClick,
  pageSize = { width: 595, height: 842 },
}: PdfThumbnailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [renderStatus, setRenderStatus] = useState<'idle' | 'rendering' | 'success' | 'error'>('idle');
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Lazy render thumbnail
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { rootMargin: '100px' }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let isCurrent = true;
    let renderTask: any = null;

    async function drawThumbnail() {
      if (!isVisible || !pdfDoc) return;
      
      setRenderStatus('rendering');
      try {
        const page = await pdfDoc.getPage(pageNumber);
        if (!isCurrent) return;

        // Thumbnails are small, usually around 100-120px wide. Scale = 0.2
        const viewport = page.getViewport({ scale: 0.18 });
        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d');
        if (!context) return;

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        } as any;

        renderTask = page.render(renderContext);
        await renderTask.promise;

        if (isCurrent) {
          setRenderStatus('success');
        }
      } catch (err) {
        if (isCurrent) {
          console.error(`Thumbnail render err page ${pageNumber}`, err);
          setRenderStatus('error');
        }
      }
    }

    drawThumbnail();

    return () => {
      isCurrent = false;
      if (renderTask) {
        try {
          renderTask.cancel();
        } catch (e) {}
      }
    };
  }, [pdfDoc, pageNumber, isVisible]);

  // Dimensions of thumbnail container
  const thumbScale = 110 / pageSize.width; // fix width to 110px
  const thumbWidth = 110;
  const thumbHeight = pageSize.height * thumbScale;

  return (
    <div
      ref={containerRef}
      onClick={onClick}
      className={`flex flex-col items-center gap-2 p-2 rounded-xl border transition-all duration-200 cursor-pointer text-center select-none ${
        isActive
          ? 'border-[#AA262C] bg-red-50/50 ring-4 ring-[#AA262C]/10 font-bold'
          : 'border-slate-100 bg-white hover:border-slate-300 hover:bg-slate-50'
      }`}
    >
      <div
        style={{ width: `${thumbWidth}px`, height: `${thumbHeight}px` }}
        className="relative bg-slate-50 rounded border border-slate-100 shadow-xs flex items-center justify-center overflow-hidden"
      >
        <canvas
          ref={canvasRef}
          className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-300 ${
            renderStatus === 'success' ? 'opacity-100' : 'opacity-0'
          }`}
        />
        
        {renderStatus !== 'success' && (
          <div className="absolute inset-0 flex items-center justify-center text-slate-300">
            {renderStatus === 'rendering' ? (
              <Loader2 className="animate-spin text-[#AA262C]/60" size={16} />
            ) : (
              <span className="text-[10px] font-mono text-slate-400">p. {pageNumber}</span>
            )}
          </div>
        )}
      </div>
      
      <span className={`text-[10px] font-bold ${isActive ? 'text-[#AA262C]' : 'text-slate-500'}`}>
        Page {pageNumber}
      </span>
    </div>
  );
}
