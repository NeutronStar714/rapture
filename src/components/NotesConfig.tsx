import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { DEFAULT_NOTES_SETTINGS, type NotesSettings } from '../utils/notesExport';

export default function NotesConfig({ settings, onChange, onClose, onExport, exporting }: {
  settings: NotesSettings; onChange: (settings: NotesSettings) => void; onClose: () => void;
  onExport: () => void; exporting: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  const update = <K extends keyof NotesSettings>(key: K, value: NotesSettings[K]) => onChange({ ...settings, [key]: value });
  const check = (key: 'showPosition' | 'citations' | 'includeEmpty' | 'documentTitle', label: string) => (
    <label className="flex items-center justify-between gap-6 py-2 cursor-pointer">
      <span>{label}</span><input type="checkbox" checked={settings[key]} onChange={e => update(key, e.target.checked)} className="accent-[#AA262C] w-4 h-4" />
    </label>
  );
  return (
    <dialog ref={dialog} aria-labelledby="notes-config-title" onClose={onClose}
      className="m-auto w-[520px] max-w-[calc(100vw-32px)] max-h-[85vh] rounded-2xl border border-gray-200 bg-white text-slate-800 p-0 shadow-2xl backdrop:bg-black/40">
      <header className="flex justify-between items-center border-b border-gray-200 px-6 py-4">
        <h2 id="notes-config-title" className="font-bold text-lg">Notes Config</h2>
        <button autoFocus onClick={() => dialog.current?.close()} aria-label="Close Notes Config" className="p-2 rounded hover:bg-gray-100"><X size={18} /></button>
      </header>
      <div className="px-6 py-4 text-sm space-y-5 overflow-y-auto">
        <fieldset className="space-y-2">
          <legend className="font-bold text-[#AA262C] mb-2">General Settings</legend>
          <label className="block" htmlFor="note-text-size">Note text size <span className="float-right font-mono">{settings.textSize}px</span></label>
          <input id="note-text-size" type="range" min="14" max="40" step="1" value={settings.textSize}
            onChange={e => update('textSize', Number(e.target.value))} className="notes-size-slider"
            style={{ '--slider-progress': `${(settings.textSize - 14) / 26 * 100}%` } as React.CSSProperties} />
          {check('showPosition', 'Show position labels')}
          <p className="text-xs text-gray-500">Applies to the Notes Deck. Preferences are remembered on this computer.</p>
        </fieldset>
        <fieldset className="space-y-2 border-t border-gray-200 pt-4">
          <legend className="font-bold text-[#AA262C] px-1">Export Settings</legend>
          <label className="flex items-center justify-between gap-6 py-2">Export format
            <select value={settings.format} onChange={e => update('format', e.target.value as NotesSettings['format'])} className="rounded border border-gray-300 p-2 bg-white">
              <option value="rapture">Rapture (.rapture)</option><option value="markdown">Markdown (.md)</option>
            </select>
          </label>
          <p className="text-xs text-gray-500">Rapture files keep all marks and can be imported. Markdown is for reading and sharing.</p>
          <div className={settings.format !== 'markdown' ? 'opacity-60' : ''}>
            <label className="flex items-center justify-between gap-6 py-2">Markdown note order
              <select disabled={settings.format !== 'markdown'} value={settings.order} onChange={e => update('order', e.target.value as NotesSettings['order'])} className="rounded border border-gray-300 p-2 bg-white">
                <option value="position">Page and position</option><option value="created">Creation time</option>
              </select>
            </label>
            <fieldset disabled={settings.format !== 'markdown'}>
              {check('documentTitle', 'Include document filename as a heading')}
              {check('includeEmpty', 'Include notes with empty comments')}
              {check('citations', 'Quote highlighted or nearby text')}
              <label className="flex items-center justify-between gap-6 py-2">Maximum citation length
                <select disabled={!settings.citations} value={settings.citationLength} onChange={e => update('citationLength', Number(e.target.value))} className="rounded border border-gray-300 p-2 bg-white">
                  {[100, 200, 400].map(n => <option key={n} value={n}>{n} characters</option>)}
                </select>
              </label>
            </fieldset>
            <p className="text-xs text-gray-500 mt-2">Highlights quote the selected text. Eyeliner quotes nearby text when it is available.</p>
          </div>
        </fieldset>
      </div>
      <footer className="flex justify-between items-center border-t border-gray-200 px-6 py-4">
        <button onClick={() => onChange({ ...DEFAULT_NOTES_SETTINGS })} className="text-sm underline text-gray-500">Reset settings</button>
        <button disabled={exporting} onClick={onExport} className="px-4 py-2 rounded-lg bg-[#AA262C] text-white text-sm font-semibold disabled:opacity-50">{exporting ? 'Exporting…' : 'Export notes'}</button>
      </footer>
    </dialog>
  );
}
