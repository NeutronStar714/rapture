import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { EyelinerNote } from '../types';

/** Quotes come from PDF text, never from a character-count approximation of page height. */
export async function noteCitations(pdf: PDFDocumentProxy, notes: EyelinerNote[], limit: number, rotation = 0): Promise<Record<string, string>> {
  const quotes: Record<string, string> = {};
  for (const number of new Set(notes.map(n => n.pageNumber))) {
    if (number < 1 || number > pdf.numPages) continue;
    const page = await pdf.getPage(number);
    const content = await page.getTextContent();
    const items = content.items.filter((item): item is typeof item & { str: string; transform: number[] } => 'str' in item);
    const text = items.map(item => item.str).join('');
    const viewport = page.getViewport({ scale: 1, rotation });
    for (const note of notes.filter(n => n.pageNumber === number)) {
      if (note.highlight) {
        if (note.highlight.end <= text.length) {
          let offset = 0;
          quotes[note.id] = items.map(item => {
            const start = Math.max(0, note.highlight!.start - offset);
            const end = Math.min(item.str.length, note.highlight!.end - offset);
            offset += item.str.length;
            return start < end ? item.str.slice(start, end) + ('hasEOL' in item && item.hasEOL ? '\n' : '') : '';
          }).join('');
        }
      } else {
        const closest = items.reduce((best, item, i) => {
          if (!item.str.trim()) return best;
          const y = viewport.convertToViewportPoint(item.transform[4], item.transform[5])[1] / viewport.height;
          return Math.abs(y - note.yPercent) < best.distance ? { index: i, distance: Math.abs(y - note.yPercent) } : best;
        }, { index: 0, distance: Infinity });
        let excerpt = '';
        for (let i = closest.index; i < items.length && excerpt.length < limit; i++) excerpt += (excerpt ? ' ' : '') + items[i].str;
        quotes[note.id] = excerpt;
      }
    }
  }
  return quotes;
}
