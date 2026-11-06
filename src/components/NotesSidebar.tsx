import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { X, PenTool, Highlighter, Trash2, ArrowDownToLine, Download, Upload, Crosshair, Move } from 'lucide-react';
import { EyelinerNote } from '../types';
import { tauriExportDialog } from '../utils/tauri';
import { autosizeTextarea, needsManualAutosize } from '../utils/textareaAutosize';
import { parseNote } from '../utils/highlights';
import NotesConfig from './NotesConfig';
import { markdownNotes, readNotesSettings, NOTES_SETTINGS_KEY, type NotesSettings } from '../utils/notesExport';
import { locateNearestNote } from '../utils/nearestNote';
import { flashRed } from '../utils/flashRed';

interface NotesSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  fileName: string;
  currentPage: number;
  epub?: boolean;
  findNearest?: () => EyelinerNote | undefined;
  getCitations: (notes: EyelinerNote[], limit: number) => Promise<Record<string, string>>;
  eyelinerActive: boolean;
  highlighterActive: boolean;
  eyelinerNotes: EyelinerNote[];
  moveNoteId: string | null;
  revisionMode?: boolean;
  onToggleEyeliner: () => void;
  onToggleHighlighter: () => void;
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
  epub = false,
  findNearest,
  getCitations,
  eyelinerActive,
  highlighterActive,
  eyelinerNotes,
  moveNoteId,
  revisionMode = false,
  onToggleEyeliner,
  onToggleHighlighter,
  onUpdateNoteText,
  onDeleteNote,
  onScrollToLine,
  onStartMoveNote,
  onImportNotes,
}: NotesSidebarProps) {
  const [configOpen, setConfigOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [settingsError, setSettingsError] = useState('');
  const [settings, setSettings] = useState(() => {
    try { return readNotesSettings(localStorage.getItem(NOTES_SETTINGS_KEY)); }
    catch { return readNotesSettings(null); }
  });
  const changeSettings = (next: NotesSettings) => {
    setSettings(next);
    try { localStorage.setItem(NOTES_SETTINGS_KEY, JSON.stringify(next)); setSettingsError(''); }
    catch { setSettingsError('Settings apply now, but could not be remembered on this computer.'); }
  };
  const importInputRef = useRef<HTMLInputElement>(null);
  const locateAnimation = useRef<Animation | null>(null);
  useEffect(() => () => locateAnimation.current?.cancel(), []);

  // Sort notes by page number then by vertical position
  const sortedNotes = [...eyelinerNotes].sort((a, b) => {
    if (a.pageNumber !== b.pageNumber) return a.pageNumber - b.pageNumber;
    return a.yPercent - b.yPercent;
  });

  /** Find the mark closest to the vertical center of the viewer. */
  const handleLocateNearest = () => {
    if (sortedNotes.length === 0) return;
    const viewer = document.getElementById('pdf-view-scroll-container');
    const nearest = findNearest ? findNearest() : viewer ? locateNearestNote(sortedNotes, viewer, currentPage) : undefined;
    if (!nearest) return;
    const el = document.getElementById(`note-row-${nearest.id}`);
    if (el) {
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      el.scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth', block: 'start' });
      locateAnimation.current?.cancel();
      locateAnimation.current = flashRed(el, 300);
    }
  };

  /** Export notes — native save dialog (Tauri) or browser download */
  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const notes = eyelinerNotes.map(n => ({ ...n }));
      const markdown = settings.format === 'markdown'
        ? markdownNotes(fileName, notes, settings, settings.citations ? await getCitations(notes, settings.citationLength) : {})
        : undefined;
      const tauriResult = await tauriExportDialog(fileName, notes, markdown);
      if (tauriResult !== undefined) return;
      const content = markdown ?? JSON.stringify({ version: 1, type: 'rapture-eyeliner-notes', exportedAt: new Date().toISOString(), fileName, notes }, null, 2);
      const blob = new Blob([content], { type: markdown !== undefined ? 'text/markdown;charset=utf-8' : 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'rapture_notes_' + fileName.replace(/\.[^.]+$/, '') + (markdown !== undefined ? '.md' : '.rapture');
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { alert('Could not export notes: ' + String(error)); }
    finally { setExporting(false); }
  };

  const handleImportClick = () => importInputRef.current?.click();

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    if (!/\.rapture$/i.test(file.name)) {
      alert('Choose a .rapture notes file.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        if (parsed.type !== 'rapture-eyeliner-notes' || !Array.isArray(parsed.notes)) {
          alert('Invalid notes file. Expected a Rapture eyeliner-notes export.');
          return;
        }
        const notes: EyelinerNote[] = parsed.notes.map((n: any) => parseNote({ ...n, text: n.text ?? '' }));
        if (notes.some(note => (note.epubOffset !== undefined) !== epub)) {
          alert('These notes are anchored to a different document format.');
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
      {configOpen && <NotesConfig settings={settings} onChange={changeSettings} onClose={() => setConfigOpen(false)} onExport={handleExport} exporting={exporting} />}
      {settingsError && <p role="alert" className="text-xs text-red-700 p-2">{settingsError}</p>}
      <input ref={importInputRef} type="file" accept=".rapture" className="hidden" onChange={handleImportFile} />

      {/* ── Header ── */}
      <div className="px-3 py-2.5 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
        <div className="flex items-center gap-1.5">
          <PenTool size={13} className="text-[#AA262C]" />
          <button onClick={() => setConfigOpen(true)} aria-haspopup="dialog" title="Open Notes Config" className="text-[10px] font-bold text-gray-500 hover:text-[#AA262C] uppercase tracking-widest rounded focus-visible:outline-2 focus-visible:outline-[#AA262C]">Notes Deck</button>
          {eyelinerNotes.length > 0 && (
            <span className="text-[10px] text-gray-300 font-mono ml-1">{eyelinerNotes.length}</span>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={onToggleHighlighter}
            aria-label="Highlighter"
            aria-pressed={highlighterActive}
            title="Highlighter — drag text to toggle highlighting"
            className={`p-1.5 rounded transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[#AA262C] ${highlighterActive ? 'text-[#AA262C] bg-[#AA262C]/15 ring-1 ring-[#AA262C]' : 'text-gray-400 hover:text-[#AA262C] hover:bg-[#AA262C]/5'}`}
          >
            <Highlighter size={14} aria-hidden="true" />
          </button>
          {sortedNotes.length > 0 && (
            <button onClick={handleLocateNearest} className="p-1 rounded text-gray-400 hover:text-[#AA262C] hover:bg-[#AA262C]/5 transition-colors cursor-pointer" title="Locate nearest note">
              <Crosshair size={12} />
            </button>
          )}
          {eyelinerNotes.length > 0 && (
            <button onClick={handleExport} disabled={exporting} className="p-1 rounded text-gray-400 hover:text-[#AA262C] hover:bg-[#AA262C]/5 transition-colors cursor-pointer" title="Export notes to file">
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
      {(eyelinerActive || highlighterActive) && (
        <div className="px-3 py-2 bg-[#AA262C]/5 border-b border-[#AA262C]/10 shrink-0">
          <p className="text-[10px] text-[#AA262C] font-semibold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#AA262C] animate-pulse" />
            {highlighterActive
              ? (moveNoteId ? 'Drag text to reposition this note' : 'Drag text to add or remove highlighting')
              : moveNoteId
              ? 'Click in the document to move this Eyeliner note'
              : 'Click in the document to place an Eyeliner note'}
          </p>
        </div>
      )}

      {/* ── Notes area (scrollbar visible, row-based layout) ── */}
      <div className="flex-1 overflow-y-auto">
        {sortedNotes.length === 0 && !eyelinerActive && !highlighterActive && (
          <div className="flex flex-col items-center justify-center text-center py-12 text-slate-400 gap-1.5 px-4">
            <PenTool size={22} className="text-slate-300" />
            <p className="text-xs font-semibold text-slate-500">No notes yet</p>
            <p className="text-[10px] text-slate-400 max-w-[200px] leading-normal">
              Use Eyeliner to mark a position, or the marker above to highlight text.
            </p>
          </div>
        )}

        {sortedNotes.length === 0 && (eyelinerActive || highlighterActive) && (
          <div className="flex flex-col items-center justify-center text-center py-12 text-slate-400 gap-2 px-4">
            <div className="w-8 h-0.5 rounded bg-[#AA262C]/30" />
            <p className="text-[10px] text-slate-400 max-w-[200px] leading-normal">
              {highlighterActive ? 'Drag across text. Drag across highlighted text to remove it.' : 'Move your mouse over the document and click to annotate.'}
            </p>
          </div>
        )}

        {sortedNotes.map((note, i) => (
          <React.Fragment key={note.id}>
            <NoteRow
              note={note}
              textSize={settings.textSize}
              showPosition={settings.showPosition}
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
            title="Toggle Eyeliner mode"
            aria-pressed={eyelinerActive}
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
  textSize: number;
  showPosition: boolean;
  note: EyelinerNote;
  moveNoteId: string | null;
  onUpdateText: (id: string, text: string) => void;
  onDelete: (id: string) => void;
  onScrollToLine: (note: EyelinerNote) => void;
  onStartMoveNote: (id: string) => void;
}

// Engines without CSS field-sizing (WebKit before Safari 26) get a manual autosize instead.
const manualAutosize = needsManualAutosize();

function NoteRow({ textSize, showPosition, note, moveNoteId, onUpdateText, onDelete, onScrollToLine, onStartMoveNote }: NoteRowProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    if (manualAutosize) autosizeTextarea(textareaRef.current);
  }, [note.text, textSize]);

  const compact = textSize < 25;
  const controls = (
      <div className={compact ? 'flex items-center gap-px shrink-0' : 'flex flex-col items-center gap-px pt-1 pl-1.5 pr-1 shrink-0'}>
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
          title="Delete note and its mark"
        >
          <Trash2 size={10} />
        </button>
      </div>
  );
  const position = showPosition && (
    <div className="text-[8px] font-semibold text-gray-300 tracking-wider uppercase leading-none">
      {note.epubOffset === undefined ? 'P' : 'Ch. '}{note.pageNumber} · {(note.yPercent * 100).toFixed(0)}%
    </div>
  );

  return (
    <div
      id={`note-row-${note.id}`}
      className={`flex w-full ${moveNoteId === note.id ? 'bg-[#AA262C]/5' : ''}`}
    >
      {!compact && controls}
      {/* Note body: page label + text */}
      <div className={`flex-1 min-w-0 pt-1 pb-0.5 pr-2.5 ${compact ? 'pl-1.5' : ''}`}>
        {compact ? <div className="flex items-center gap-2 mb-px">{controls}{position}</div> : position}

        {/* Note text — 30px, theme red, Arial — CSS field-sizing avoids JS layout thrash (manual fallback above where unsupported) */}
        <textarea
          ref={textareaRef}
          value={note.text}
          onChange={event => onUpdateText(note.id, event.target.value)}
          placeholder="Type note..."
          rows={1}
          className="w-full resize-none overflow-hidden bg-transparent border-none outline-hidden p-0 m-0 leading-[1.15]"
          style={{
            fontFamily: 'Arial, sans-serif',
            fontSize: textSize,
            fontWeight: 400,
            color: '#AA262C',
            fieldSizing: 'content',
          }}
        />
      </div>
    </div>
  );
}
