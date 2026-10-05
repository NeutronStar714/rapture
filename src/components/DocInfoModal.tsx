import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, FileText, Info, Calendar, Monitor, Cpu } from 'lucide-react';
import { PdfMetadata } from '../types';

interface DocInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  metadata: PdfMetadata | null;
  fileName: string;
}

export default function DocInfoModal({ isOpen, onClose, metadata, fileName }: DocInfoModalProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          id="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-xs"
        />

        {/* Modal content */}
        <motion.div
          id="modal-content"
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: 'spring', duration: 0.35 }}
          className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl border border-slate-100"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rapture-light text-rapture">
                <Info size={18} />
              </div>
              <h3 className="font-display font-semibold text-slate-800">Document Properties</h3>
            </div>
            <button
              id="close-metadata-btn"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Details */}
          <div className="max-h-[70vh] overflow-y-auto px-6 py-5 space-y-4 font-sans">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">File Name</p>
              <p className="text-sm font-medium text-slate-800 break-all">{fileName}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Total Pages</p>
                <p className="text-sm font-medium text-slate-800">{metadata?.totalPages || 'Unknown'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">PDF Version</p>
                <p className="text-sm font-medium text-slate-800">{metadata?.pdfVersion || 'N/A'}</p>
              </div>
            </div>

            <div className="border-t border-slate-100 my-2 pt-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                <FileText size={14} /> Document Metadata
              </h4>
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-sm text-slate-500">Title:</span>
                  <span className="text-sm font-medium text-slate-800 col-span-2 break-words">{metadata?.title || 'None'}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-sm text-slate-500">Author:</span>
                  <span className="text-sm font-medium text-slate-800 col-span-2 break-words">{metadata?.author || 'Unknown'}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-sm text-slate-500">Subject:</span>
                  <span className="text-sm font-medium text-slate-800 col-span-2 break-words">{metadata?.subject || 'None'}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-sm text-slate-500">Keywords:</span>
                  <span className="text-sm font-medium text-slate-800 col-span-2 break-words">{metadata?.keywords || 'None'}</span>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100 my-2 pt-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                <Calendar size={14} /> Dates
              </h4>
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-sm text-slate-500">Created:</span>
                  <span className="text-sm font-medium text-slate-800 col-span-2">{metadata?.creationDate || 'N/A'}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-sm text-slate-500">Modified:</span>
                  <span className="text-sm font-medium text-slate-800 col-span-2">{metadata?.modificationDate || 'N/A'}</span>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100 my-2 pt-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                <Cpu size={14} /> Production Environment
              </h4>
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-sm text-slate-500">Application:</span>
                  <span className="text-sm font-medium text-slate-800 col-span-2">{metadata?.creator || 'N/A'}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-sm text-slate-500">PDF Producer:</span>
                  <span className="text-sm font-medium text-slate-800 col-span-2 break-words">{metadata?.producer || 'N/A'}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-sm text-slate-500">Approx. File Size:</span>
                  <span className="text-sm font-medium text-slate-800 col-span-2">{metadata?.fileSize || 'Unknown'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end border-t border-slate-100 bg-slate-50 px-6 py-4">
            <button
              id="close-properties-modal-btn"
              onClick={onClose}
              className="rounded-xl bg-slate-800 px-5 py-2 text-sm font-medium text-white hover:bg-slate-700 transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
