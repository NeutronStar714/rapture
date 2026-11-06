import type { EyelinerNote } from '../types.ts';
import { anchorY, readChapterGlyph } from './epubAnchor.ts';
import { highlightRects } from './highlightDom.ts';

export function epubNoteRects(content: HTMLElement, note: EyelinerNote): DOMRect[] {
  if (note.epubOffset === undefined) return [];
  const chapter = content.querySelector<HTMLElement>(`#epub-chapter-${note.pageNumber}`);
  if (!chapter) return [];
  if (note.highlight) return highlightRects(chapter, note.highlight);
  const anchor = readChapterGlyph(chapter, note.epubOffset);
  const y = anchor && anchorY(anchor);
  const bounds = content.getBoundingClientRect();
  return y === undefined ? [] : [new DOMRect(bounds.left, y - 1, bounds.width, 2)];
}

export function epubNoteCitations(chapters: { text: string }[], notes: EyelinerNote[], limit: number): Record<string, string> {
  const quotes: Record<string, string> = Object.create(null);
  for (const note of notes) {
    const text = chapters[note.pageNumber - 1]?.text;
    if (note.epubOffset === undefined || !text || note.epubOffset >= text.length) continue;
    quotes[note.id] = note.highlight
      ? text.slice(note.highlight.start, note.highlight.end)
      : text.slice(Math.max(0, note.epubOffset - Math.floor(limit / 3)), note.epubOffset + limit);
  }
  return quotes;
}
