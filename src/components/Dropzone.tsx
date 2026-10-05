import React, { useRef, useState } from 'react';
import { motion } from 'motion/react';
import { UploadCloud, FileType, CheckCircle, ArrowRight, Play, Trash2 } from 'lucide-react';
import { RecentPdf } from '../types';

interface DropzoneProps {
  onFileSelect: (file: File) => void;
  onLoadSample: () => void;
  recentPdfs: RecentPdf[];
  onLoadRecent: (pdf: RecentPdf) => void;
  onDeleteRecent: (pdf: RecentPdf) => void;
}

export default function Dropzone({ onFileSelect, onLoadSample, recentPdfs, onLoadRecent, onDeleteRecent }: DropzoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragActive, setIsDragActive] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        onFileSelect(file);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileSelect(e.target.files[0]);
    }
  };

  return (
    <div className="w-full h-full overflow-y-auto flex flex-col items-center p-8 max-w-5xl mx-auto font-sans text-center no-scrollbar">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="mb-8"
      >
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-50 text-[#AA262C] font-bold text-xs mb-4 border border-red-100/60">
          <span className="flex h-1.5 w-1.5 rounded-full bg-[#AA262C] animate-pulse"></span>
          OFFLINE PDF READER
        </div>
        <h1 className="font-sans text-4xl md:text-5xl font-black tracking-tight text-black mb-3 rapture-title">
          Do you believe in <span className="text-[#AA262C]">Rapture</span>?
        </h1>
      </motion.div>

      {/* Drag & Drop Area (Wider & Flatter Rectangle) */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.15 }}
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative w-full max-w-4xl p-6 md:p-8 rounded-2xl border-2 border-dashed transition-all duration-300 cursor-pointer flex flex-col md:flex-row items-center justify-between gap-6 ${
          isDragActive
            ? 'border-[#AA262C] bg-red-50/30 scale-[1.01] shadow-xl'
            : 'border-slate-200 bg-white hover:border-[#AA262C]/40 hover:shadow-lg'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          onChange={handleFileChange}
          className="hidden"
        />

        <div className="flex items-center gap-4 text-left">
          <div className={`p-3.5 rounded-full transition-colors duration-300 shrink-0 ${isDragActive ? 'bg-red-50 text-[#AA262C]' : 'bg-slate-50 text-slate-400'}`}>
            <UploadCloud size={28} className={isDragActive ? 'animate-bounce' : ''} />
          </div>
          <div>
            <p className="text-slate-800 font-bold text-base">
              Drag and drop your PDF here
            </p>
            <p className="text-slate-500 text-xs mt-0.5">
              or <span className="text-[#AA262C] hover:text-[#8b1e24] underline font-bold">browse your computer files</span> to begin
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6 text-[11px] font-bold text-gray-500 border-t md:border-t-0 md:border-l border-slate-200 pt-4 md:pt-0 md:pl-6 w-full md:w-auto justify-center md:justify-end shrink-0">
          <span className="flex items-center gap-1"><CheckCircle size={13} className="text-emerald-500" /> High Performance</span>
          <span className="flex items-center gap-1"><CheckCircle size={13} className="text-emerald-500" /> 100% Offline Guard</span>
        </div>
      </motion.div>

      {/* Recently Opened Documents Row Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.25 }}
        className="w-full max-w-4xl mt-12 text-left"
      >
        <div className="flex items-center justify-between border-b border-gray-200 pb-2.5 mb-6">
          <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
            <span className="w-1.5 h-3 bg-[#AA262C] rounded-xs"></span>
            Recently Opened Documents
          </h3>
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{recentPdfs.length} Items</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full pb-16">
          {recentPdfs.map((pdf, idx) => {
            const label = pdf.name.toLowerCase().includes('guide') ? 'GUIDE' : pdf.name.toLowerCase().includes('report') ? 'REPORT' : 'SECURE';
            const pageStr = pdf.name.toLowerCase().includes('guide') ? '12 Pages' : pdf.name.toLowerCase().includes('report') ? '8 Pages' : '48 Pages';
            return (
              <div 
                key={pdf.name + '-' + idx}
                onClick={(e) => {
                  e.stopPropagation();
                  onLoadRecent(pdf);
                }}
                className="group flex flex-col bg-white rounded-xl border border-gray-200 overflow-hidden hover:border-[#AA262C]/40 hover:shadow-lg transition-all duration-200 cursor-pointer h-full"
              >
                {/* Cover section (Page 1 preview) */}
                <div className="w-full h-64 bg-slate-50 border-b border-gray-100 relative flex items-center justify-center p-4 overflow-hidden">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteRecent(pdf);
                    }}
                    className="absolute top-3 right-3 p-2 rounded-full bg-white/95 hover:bg-red-50 border border-slate-200/80 hover:border-red-200 text-slate-400 hover:text-red-600 hover:scale-105 shadow-xs transition-all duration-150 z-10 cursor-pointer"
                    title="Delete document"
                  >
                    <Trash2 size={13} />
                  </button>

                  {pdf.coverUrl ? (
                    <img 
                      src={pdf.coverUrl} 
                      className="h-full object-contain shadow-md rounded group-hover:scale-[1.02] transition-transform duration-300" 
                      alt={pdf.name} 
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    /* Elegant placeholder if no real cover image yet */
                    <div className="h-full w-40 bg-white border border-gray-200 rounded p-4 flex flex-col justify-between shadow-xs group-hover:border-[#AA262C]/30 transition-all duration-200">
                      <div className="space-y-2">
                        <div className={`h-1.5 w-12 rounded ${idx % 3 === 0 ? 'bg-[#AA262C]/20' : idx % 3 === 1 ? 'bg-amber-600/20' : 'bg-indigo-600/20'}`}></div>
                        <div className="h-3.5 w-full bg-slate-100 rounded"></div>
                        <div className="h-2 w-3/4 bg-slate-50 rounded"></div>
                      </div>
                      <div className="space-y-1">
                        <div className="h-1 w-full bg-slate-50 rounded"></div>
                        <div className="h-1 w-5/6 bg-slate-50 rounded"></div>
                        <div className="h-1 w-2/3 bg-slate-50 rounded"></div>
                      </div>
                      <div className="flex justify-between items-center text-[8px] text-gray-400 font-mono mt-2">
                        <span>{pageStr}</span>
                        <span className="uppercase text-[7px] px-1 py-0.5 rounded bg-slate-100 font-bold">{label}</span>
                      </div>
                    </div>
                  )}
                </div>
                {/* Meta details section */}
                <div className="p-4 flex flex-col justify-between flex-grow text-left">
                  <div className="mb-4">
                    <h4 className="text-sm font-bold text-gray-900 group-hover:text-[#AA262C] transition-colors line-clamp-1 mb-1" title={pdf.name}>
                      {pdf.name}
                    </h4>
                    <p className="text-xs text-gray-400 font-medium truncate">{pdf.subText}</p>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100 mt-auto text-[11px] font-bold text-[#AA262C]">
                    <span className="flex items-center gap-1">
                      <span>Open Document</span>
                      <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                    </span>
                    <span className="text-gray-400 font-normal text-[10px]">
                      {new Date(pdf.openedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* Copyright */}
      <p className="text-[11px] text-gray-400 mt-auto pt-8 font-sans select-none">
        © 2026 NeutronStar714
      </p>
    </div>
  );
}
