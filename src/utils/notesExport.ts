import type { EyelinerNote } from '../types.ts';

export interface NotesSettings {
  textSize: number;
  showPosition: boolean;
  format: 'rapture' | 'markdown';
  order: 'position' | 'created';
  citations: boolean;
  citationLength: number;
  includeEmpty: boolean;
  documentTitle: boolean;
}
export const DEFAULT_NOTES_SETTINGS: NotesSettings = {
  textSize: 30, showPosition: true, format: 'rapture', order: 'position',
  citations: false, citationLength: 200, includeEmpty: true, documentTitle: false,
};
export const NOTES_SETTINGS_KEY = 'rapture_notes_settings';
export function readNotesSettings(raw: string | null): NotesSettings {
  const settings = { ...DEFAULT_NOTES_SETTINGS };
  try {
    const value = JSON.parse(raw ?? '{}');
    if (!value || typeof value !== 'object') return settings;
    if (typeof value.textSize === 'number' && Number.isFinite(value.textSize)) settings.textSize = Math.max(14, Math.min(40, value.textSize));
    for (const key of ['showPosition', 'citations', 'includeEmpty', 'documentTitle'] as const) if (typeof value[key] === 'boolean') settings[key] = value[key];
    if (value.format === 'rapture' || value.format === 'markdown') settings.format = value.format;
    if (value.order === 'position' || value.order === 'created') settings.order = value.order;
    if ([100, 200, 400].includes(value.citationLength)) settings.citationLength = value.citationLength;
  } catch { /* Use defaults for damaged preferences. */ }
  return settings;
}

export function markdownNotes(fileName: string, notes: EyelinerNote[], settings: NotesSettings, citations: Record<string, string> = {}): string {
  const sorted = notes.filter(n => settings.includeEmpty || n.text.trim()).slice().sort((a, b) =>
    settings.order === 'created' ? a.timestamp - b.timestamp : a.pageNumber - b.pageNumber || a.yPercent - b.yPercent || (a.highlight?.start ?? 0) - (b.highlight?.start ?? 0));
  const blocks = sorted.map(note => {
    const heading = `**${note.epubOffset === undefined ? 'P' : 'Ch. '}${note.pageNumber}** **${(note.yPercent * 100).toFixed(0)}%** **${note.highlight ? 'Highlight' : 'Eyeliner'}**  `;
    const quote = settings.citations && citations[note.id] ? `\n\n> ${citations[note.id].replace(/\s+/g, ' ').trim().slice(0, settings.citationLength).replace(/[\\`*_{}\[\]<>]/g, '\\$&')}` : '';
    return `${heading}\n${note.text.trim()}${quote}`;
  });
  // An HTML-free title keeps a document filename from becoming Markdown markup.
  const title = settings.documentTitle ? `# ${fileName.replace(/[\\`*_{}\[\]<>#]/g, '\\$&')}\n\n` : '';
  return title + blocks.join('\n\n') + (blocks.length ? '\n' : '');
}
