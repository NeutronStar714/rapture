import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { DEFAULT_EPUB_SETTINGS, type EpubSettings } from '../utils/epubSettings';
import type { ReadingTheme } from '../types';

export default function EpubOptions({ settings, onChange, theme, onTheme, onClose }: {
  settings: EpubSettings; onChange: (settings: EpubSettings) => void;
  theme: ReadingTheme; onTheme: (theme: ReadingTheme) => void; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [font, setFont] = useState(settings.font);
  useEffect(() => { dialog.current?.showModal(); }, []);
  const update = <K extends keyof EpubSettings>(key: K, value: EpubSettings[K]) => onChange({ ...settings, [key]: value });
  const range = (key: 'size' | 'lineHeight' | 'margins', label: string, min: number, max: number, step: number, unit = '') => (
    <label className="block space-y-1">
      <span className="flex justify-between"><span>{label}</span><span className="font-mono">{settings[key]}{unit}</span></span>
      <input className="notes-size-slider" type="range" min={min} max={max} step={step} value={settings[key]}
        style={{ '--slider-progress': `${(settings[key] - min) / (max - min) * 100}%` } as React.CSSProperties}
        onChange={e => update(key, Number(e.target.value))} />
    </label>
  );
  const commitFont = (value: string) => {
    const next = value.trim() || DEFAULT_EPUB_SETTINGS.font;
    if (next !== settings.font) update('font', next);
    setFont(next);
  };
  return (
    <dialog ref={dialog} onClose={onClose} aria-labelledby="epub-options-title" className="m-auto w-[480px] max-w-[calc(100vw-32px)] max-h-[85vh] rounded-xl border border-gray-200 bg-white text-slate-800 p-0 shadow-xl backdrop:bg-black/40">
      <header className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
        <h2 id="epub-options-title" className="text-lg font-semibold">EPUB Options</h2>
        <button autoFocus aria-label="Close EPUB Options" onClick={() => dialog.current?.close()} className="rounded p-2 hover:bg-gray-100"><X size={18} /></button>
      </header>
      <div className="space-y-4 p-5 text-sm">
        {range('size', 'Size', 12, 60, 1, 'px')}
        <label className="block space-y-1">
          <span>Font</span>
          <input list="epub-font-suggestions" value={font} maxLength={160} onChange={e => setFont(e.target.value)} onBlur={e => commitFont(e.currentTarget.value)}
            onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
            className="block w-full rounded border border-gray-300 px-3 py-2" />
        </label>
        <datalist id="epub-font-suggestions">{['Georgia','Times New Roman','Palatino','Arial','Verdana','Microsoft YaHei','PingFang SC','Noto Serif CJK SC'].map(name => <option key={name} value={name} />)}</datalist>
        <p className="text-xs text-gray-500">Enter the family name of any installed font. Press Enter to apply it.</p>
        <label className="flex items-center justify-between gap-4">Alignment
          <select className="rounded border border-gray-300 bg-white p-2" value={settings.align} onChange={e => update('align', e.target.value as EpubSettings['align'])}>
            <option value="justify">Justified</option><option value="start">Start aligned</option>
          </select>
        </label>
        {range('lineHeight', 'Line spacing', 1.2, 2, 0.05)}
        {range('margins', 'Side margins', 8, 64, 2, 'px')}
        <label className="flex items-center justify-between gap-4">Reading theme
          <select className="rounded border border-gray-300 bg-white p-2" value={theme} onChange={e => onTheme(e.target.value as ReadingTheme)}>
            <option value="light">Light</option><option value="sepia">Sepia</option><option value="dark">Dark</option>
          </select>
        </label>
        <label className="flex items-center justify-between gap-4">
          <span>Show chapter progress</span>
          <input type="checkbox" className="h-4 w-4 accent-[#AA262C]" checked={settings.showChapterProgress}
            onChange={e => update('showChapterProgress', e.currentTarget.checked)} />
        </label>
      </div>
      <footer className="border-t border-gray-200 px-5 py-3">
        <button className="text-sm underline text-gray-500" onClick={() => {
          setFont(DEFAULT_EPUB_SETTINGS.font);
          onChange({ ...DEFAULT_EPUB_SETTINGS, showChapterProgress: settings.showChapterProgress });
        }}>Reset typography</button>
      </footer>
    </dialog>
  );
}
