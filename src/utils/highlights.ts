import type { EyelinerNote, TextHighlight } from '../types.ts';

export interface HighlightSelection extends TextHighlight {
  pageNumber: number;
  yAt: (offset: number) => number;
  epub?: boolean;
}

/** Symmetric difference of the selection and the current highlighted text. */
export function toggleHighlights(
  notes: EyelinerNote[], selection: HighlightSelection,
  createId: () => string = () => crypto.randomUUID(),
): EyelinerNote[] {
  return combineHighlights(notes, selection, createId, false);
}

/** Moving a note covers the destination; existing highlights there stay highlighted. */
export function moveHighlight(notes: EyelinerNote[], id: string, selections: HighlightSelection[]): EyelinerNote[] {
  const source = notes.find(note => note.id === id);
  if (!source?.highlight || !selections.length) return notes;
  let next = notes.filter(note => note.id !== id);
  selections.forEach((selection, i) => {
    const moved = { ...source, id: i === 0 ? source.id : crypto.randomUUID(), pageNumber: selection.pageNumber,
      highlight: { start: selection.start, end: selection.end } };
    next = combineHighlights([...next, moved], selection, () => crypto.randomUUID(), true);
  });
  return next;
}

function combineHighlights(
  notes: EyelinerNote[], selection: HighlightSelection, createId: () => string, add: boolean,
): EyelinerNote[] {
  const { start, end, pageNumber } = selection;
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start) return notes;
  const belongsToSelection = (n: EyelinerNote) => n.pageNumber === pageNumber && !!n.highlight && (n.epubOffset !== undefined) === !!selection.epub;
  const existing = notes.filter(belongsToSelection);
  const boundaries = [...new Set([start, end, ...existing.flatMap(n => [n.highlight!.start, n.highlight!.end])])].sort((a, b) => a - b);
  const ranges: TextHighlight[] = [];
  for (let i = 0; i + 1 < boundaries.length; i++) {
    const a = boundaries[i], b = boundaries[i + 1];
    const wasHighlighted = existing.some(n => n.highlight!.start <= a && n.highlight!.end >= b);
    const selected = a >= start && b <= end;
    if (!(add ? wasHighlighted || selected : wasHighlighted !== selected)) continue;
    const previous = ranges.at(-1);
    if (previous?.end === a) previous.end = b;
    else ranges.push({ start: a, end: b });
  }
  const usedIds = new Set<string>();
  const result = ranges.map(highlight => {
    const sources = existing.filter(n => n.highlight!.start < highlight.end && n.highlight!.end > highlight.start);
    const source = sources.find(n => !usedIds.has(n.id));
    const id = source?.id ?? createId();
    usedIds.add(id);
    return {
      id, pageNumber, yPercent: selection.yAt(highlight.start), highlight,
      ...(selection.epub ? { epubOffset: highlight.start } : {}),
      text: [...new Set(sources.map(n => n.text).filter(Boolean))].join('\n'),
      timestamp: sources.length ? Math.min(...sources.map(n => n.timestamp)) : Date.now(),
    };
  });
  return [...notes.filter(n => !belongsToSelection(n)), ...result];
}

/** Keep the optional anchor when importing; reject malformed offsets instead of losing it. */
export function parseNote(value: unknown): EyelinerNote {
  const n = value as EyelinerNote;
  if (!n || typeof n.id !== 'string' || !n.id || !Number.isInteger(n.pageNumber) || n.pageNumber < 1 ||
      !Number.isFinite(n.yPercent) || n.yPercent < 0 || n.yPercent > 1 ||
      typeof n.text !== 'string' || !Number.isSafeInteger(n.timestamp) || n.timestamp < 0) {
    throw new Error('Some notes have invalid fields.');
  }
  if (n.highlight !== undefined && (!n.highlight || !Number.isSafeInteger(n.highlight.start) ||
      !Number.isSafeInteger(n.highlight.end) || n.highlight.start < 0 || n.highlight.end <= n.highlight.start)) {
    throw new Error('Some highlights have invalid text positions.');
  }
  if (n.epubOffset !== undefined && (!Number.isSafeInteger(n.epubOffset) || n.epubOffset < 0)) {
    throw new Error('Some EPUB notes have invalid text positions.');
  }
  return { id: n.id, pageNumber: n.pageNumber, yPercent: n.yPercent, text: n.text, timestamp: n.timestamp,
    ...(n.highlight ? { highlight: { start: n.highlight.start, end: n.highlight.end } } : {}),
    ...(n.epubOffset !== undefined ? { epubOffset: n.highlight?.start ?? n.epubOffset } : {}) };
}
