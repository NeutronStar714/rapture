import React, { useState, useEffect, useRef } from 'react';
import { X, PenTool, Trash2, ArrowDownToLine, Download, Upload, Crosshair, Move } from 'lucide-react';
import { EyelinerNote } from '../types';
import { tauriExportDialog } from '../utils/tauri';

interface NotesSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  fileName: string;
  currentPage: number;
  eyelinerActive: boolean;
  eyelinerNotes: EyelinerNote[];
  moveNoteId: string | null;
  revisionMode?: boolean;
  onToggleEyeliner: () => void;
  onUpdateNoteText: (id: string, text: string) => void;
  onDeleteNote: (id: string) => void;
  onScrollToLine: (note: EyelinerNote) => void;
  onStartMoveNote: (id: string) => void;
  onImportNotes: (notes: EyelinerNote[]) => void;
}

export default function NotesSidebar({
  isOpen,
  onClose,
  fileName,
  currentPage,
  eyelinerActive,
  eyelinerNotes,
  moveNoteId,
  revisionMode = false,
  onToggleEyeliner,
  onUpdateNoteText,
  onDeleteNote,
  onScrollToLine,
  onStartMoveNote,
  onImportNotes,
}: NotesSidebarProps) {
  const importInputRef = useRef<HTMLInputElement>(null);

  // Sort notes by page number then by vertical position
  const sortedNotes = [...eyelinerNotes].sort((a, b) => {
    if (a.pageNumber !== b.pageNumber) return a.pageNumber - b.pageNumber;
    return a.yPercent - b.yPercent;
  });

  /** Find the note nearest to the current PDF page and scroll the sidebar to it */
  const handleLocateNearest = () => {
    if (sortedNotes.length === 0) return;
    const nearest = sortedNotes.reduce((best, note) =>
      Math.abs(note.pageNumber - currentPage) < Math.abs(best.pageNumber - currentPage) ? note : best,
    );
    const el = document.getElementById(`note-row-${nearest.id}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  /** Export notes — native save dialog (Tauri) or browser download */
  const handleExport = async () => {
    try {
    // Tauri → native "Save As" dialog
    const tauriResult = await tauriExportDialog(fileName, eyelinerNotes);
    if (tauriResult !== undefined) return; // Tauri handled it (success or cancel)
    // Fallback: browser download
    const payload = {
      version: 1,
      type: 'rapture-eyeliner-notes',
      exportedAt: new Date().toISOString(),
      fileName,
      notes: eyelinerNotes,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rapture_notes_${fileName.replace(/\.[^.]+$/, '')}.rapture`;
    a.click();
    URL.revokeObjectURL(url);
    } catch (error) {
      alert('Could not export notes: ' + String(error));
    }
  };

  const handleImportClick = () => importInputRef.current?.click();

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        if (parsed.type !== 'rapture-eyeliner-notes' || !Array.isArray(parsed.notes)) {
          alert('Invalid notes file. Expected a Rapture eyeliner-notes export.');
          return;
        }
        const notes: EyelinerNote[] = parsed.notes.map((n: any) => ({
          id: n.id,
          pageNumber: n.pageNumber,
          yPercent: n.yPercent,
          text: n.text ?? '',
          timestamp: n.timestamp,
        }));
        if (notes.some((n) => !n.id || typeof n.pageNumber !== 'number')) {
          alert('Some entries in the file are missing required fields.');
          return;
        }
        if (window.confirm(`Load ${notes.length} note(s) from "${file.name}"? This will replace all current notes for this document.`)) {
          onImportNotes(notes);
        }
      } catch {
        alert('Could not read this file. Make sure it is a valid JSON file exported from Rapture.');
      }
    };
    reader.readAsText(file);
  };

  if (!isOpen) return null;

  return (
    <div
      id="notes-sidebar"
      className={`${revisionMode ? 'w-2/5' : 'w-72'} border-l border-gray-200 bg-white flex flex-col h-full shrink-0 select-none font-sans overflow-hidden z-20 shadow-2xs`}
    >
      <input ref={importInputRef} type="file" accept=".rapture,.json" className="hidden" onChange={handleImportFile} />

      {/* ── Header ── */}
      <div className="px-3 py-2.5 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
        <div className="flex items-center gap-1.5">
          <PenTool size={13} className="text-[#AA262C]" />
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Notes Deck</span>
          {eyelinerNotes.length > 0 && (
            <span className="text-[10px] text-gray-300 font-mono ml-1">{eyelinerNotes.length}</span>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          {sortedNotes.length > 0 && (
            <button onClick={handleLocateNearest} className="p-1 rounded text-gray-400 hover:text-[#AA262C] hover:bg-[#AA262C]/5 transition-colors cursor-pointer" title="Locate nearest note">
              <Crosshair size={12} />
            </button>
          )}
          {eyelinerNotes.length > 0 && (
            <button onClick={handleExport} className="p-1 rounded text-gray-400 hover:text-[#AA262C] hover:bg-[#AA262C]/5 transition-colors cursor-pointer" title="Export notes to file">
              <Download size={12} />
            </button>
          )}
          <button onClick={handleImportClick} className="p-1 rounded text-gray-400 hover:text-[#AA262C] hover:bg-[#AA262C]/5 transition-colors cursor-pointer" title="Import notes from file">
            <Upload size={12} />
          </button>
          <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-600 transition-colors cursor-pointer" title="Close Notes">
            <X size={14} />
          </button>
        </div>
      </div>

      {/* ── Eyeliner / Move-mode instruction banner ── */}
      {eyelinerActive && (
        <div className="px-3 py-2 bg-[#AA262C]/5 border-b border-[#AA262C]/10 shrink-0">
          <p className="text-[10px] text-[#AA262C] font-semibold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#AA262C] animate-pulse" />
            {moveNoteId
              ? 'Click on a PDF page to reposition this note'
              : 'Click anywhere on PDF to place lined note'}
          </p>
        </div>
      )}

      {/* ── Notes area (scrollbar visible, row-based layout) ── */}
      <div className="flex-1 overflow-y-auto">
        {sortedNotes.length === 0 && !eyelinerActive && (
          <div className="flex flex-col items-center justify-center text-center py-12 text-slate-400 gap-1.5 px-4">
            <PenTool size={22} className="text-slate-300" />
            <p className="text-xs font-semibold text-slate-500">No notes yet</p>
            <p className="text-[10px] text-slate-400 max-w-[200px] leading-normal">
              Toggle Eyeliner below, then click on a PDF page to annotate.
            </p>
          </div>
        )}

        {sortedNotes.length === 0 && eyelinerActive && (
          <div className="flex flex-col items-center justify-center text-center py-12 text-slate-400 gap-2 px-4">
            <div className="w-8 h-0.5 rounded bg-[#AA262C]/30" />
            <p className="text-[10px] text-slate-400 max-w-[200px] leading-normal">
              Move your mouse over the document and click to annotate.
            </p>
          </div>
        )}

        {sortedNotes.map((note, i) => (
          <React.Fragment key={note.id}>
            <NoteRow
              note={note}
              moveNoteId={moveNoteId}
              onUpdateText={onUpdateNoteText}
              onDelete={onDeleteNote}
              onScrollToLine={onScrollToLine}
              onStartMoveNote={onStartMoveNote}
            />
            {i < sortedNotes.length - 1 && <div className="h-px bg-gray-200 mx-3" />}
          </React.Fragment>
        ))}
      </div>

      {/* ── Bottom bar (no star icon on Eyeliner button) ── */}
      <div className="border-t border-gray-100 bg-white shrink-0">
        <div className="px-3 py-2">
          <button
            onClick={onToggleEyeliner}
            className={`w-full py-2 rounded-xl border font-bold text-xs flex items-center transition-all duration-200 cursor-pointer ${
              eyelinerActive
                ? 'bg-[#AA262C] text-white border-[#AA262C] shadow-sm scale-[0.98] justify-between px-3'
                : 'bg-white hover:bg-slate-50 text-slate-700 border-gray-200 hover:border-gray-300 shadow-2xs justify-center gap-2'
            }`}
            title="Toggle Eyeliner Highlighter mode"
          >
            <span>Eyeliner</span>
            {eyelinerActive && (
              <span className="text-[9px] bg-white/20 px-1.5 py-0.5 rounded-full uppercase tracking-wider font-bold">
                Active
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   NoteRow — row-based note with CSS field-sizing
   ═══════════════════════════════════════════════ */

interface NoteRowProps {
  note: EyelinerNote;
  moveNoteId: string | null;
  onUpdateText: (id: string, text: string) => void;
  onDelete: (id: string) => void;
  onScrollToLine: (note: EyelinerNote) => void;
  onStartMoveNote: (id: string) => void;
}

function NoteRow({ note, moveNoteId, onUpdateText, onDelete, onScrollToLine, onStartMoveNote }: NoteRowProps) {

  return (
    <div
      id={`note-row-${note.id}`}
      className={`flex w-full ${moveNoteId === note.id ? 'bg-[#AA262C]/5' : ''}`}
    >
      {/* Leftmost button column — stacked vertically, 3 buttons */}
      <div className="flex flex-col items-center gap-px pt-1 pl-1.5 pr-1 shrink-0">
        <button
          onClick={() => onScrollToLine(note)}
          className="w-3.5 h-3.5 flex items-center justify-center rounded text-gray-300 hover:text-[#AA262C] hover:bg-[#AA262C]/5 transition-colors cursor-pointer"
          title="Scroll to this line"
        >
          <ArrowDownToLine size={10} />
        </button>
        <button
          onClick={() => onStartMoveNote(note.id)}
          className={`w-3.5 h-3.5 flex items-center justify-center rounded transition-colors cursor-pointer ${
            moveNoteId === note.id
              ? 'text-[#AA262C] bg-[#AA262C]/10'
              : 'text-gray-300 hover:text-[#AA262C] hover:bg-[#AA262C]/5'
          }`}
          title={moveNoteId === note.id ? 'Cancel move' : 'Move this note'}
        >
          <Move size={10} />
        </button>
        <button
          onClick={() => onDelete(note.id)}
          className="w-3.5 h-3.5 flex items-center justify-center rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
          title="Delete note &amp; line"
        >
          <Trash2 size={10} />
        </button>
      </div>

      {/* Note body: page label + text */}
      <div className="flex-1 min-w-0 pt-1 pb-0.5 pr-2.5">
        {/* Page/position label — small, compact */}
        <div className="text-[8px] font-semibold text-gray-300 tracking-wider uppercase mb-px leading-none">
          P{note.pageNumber} · {(note.yPercent * 100).toFixed(0)}%
        </div>

        {/* Note text — 30px, theme red, Arial — CSS field-sizing avoids JS layout thrash */}
        <textarea
          value={note.text}
          onChange={event => onUpdateText(note.id, event.target.value)}
          placeholder="Type note..."
          rows={1}
          className="w-full resize-none overflow-hidden bg-transparent border-none outline-hidden p-0 m-0 leading-[1.15]"
          style={{
            fontFamily: 'Arial, sans-serif',
            fontSize: '30px',
            fontWeight: 400,
            color: '#AA262C',
            fieldSizing: 'content',
          }}
        />
      </div>
    </div>
  );
}
