import type { EyelinerNote } from '../types.ts';
import { highlightRects } from './highlightDom.ts';

export interface NotePosition {
  note: EyelinerNote;
  top: number;
  bottom: number;
}

/** Distance to the viewer's center line, including highlights that cross it. */
export function nearestNote(positions: NotePosition[], centerY: number): EyelinerNote | undefined {
  let nearest: EyelinerNote | undefined;
  let distance = Infinity;
  for (const position of positions) {
    const gap = Math.max(position.top - centerY, centerY - position.bottom, 0);
    if (gap < distance) { distance = gap; nearest = position.note; }
  }
  return nearest;
}

export function locateNearestNote(notes: EyelinerNote[], viewer: HTMLElement, currentPage: number): EyelinerNote | undefined {
  const bounds = viewer.getBoundingClientRect();
  const center = bounds.top + viewer.clientTop + viewer.clientHeight / 2;
  const positions: NotePosition[] = [];
  for (const note of notes) {
    const page = viewer.querySelector<HTMLElement>(`#pdf-page-container-${note.pageNumber}`);
    if (!page) continue;
    const pageBounds = page.getBoundingClientRect();
    const layer = page.querySelector<HTMLElement>('.rapture-text-layer');
    const rects = note.highlight && layer ? highlightRects(layer, note.highlight) : [];
    if (rects.length) {
      positions.push(...rects.map(rect => ({ note, top: rect.top, bottom: rect.bottom })));
    } else {
      const y = pageBounds.top + pageBounds.height * note.yPercent;
      positions.push({ note, top: y, bottom: y });
    }
  }
  if (positions.length) return nearestNote(positions, center);

  // Paged layouts can have no notes on the mounted pages. Use their center's page
  // fraction to choose a deck entry, rather than defaulting to the first note.
  const pages = [...viewer.querySelectorAll<HTMLElement>('[id^="pdf-page-container-"]')];
  const reference = pages.map(page => ({ page, rect: page.getBoundingClientRect() }))
    .sort((a, b) => Math.abs(a.rect.top + a.rect.height / 2 - center) - Math.abs(b.rect.top + b.rect.height / 2 - center))[0];
  const centerPosition = reference && reference.rect.height
    ? Number(reference.page.id.replace('pdf-page-container-', '')) + Math.max(0, Math.min(1, (center - reference.rect.top) / reference.rect.height))
    : currentPage + 0.5;
  return nearestNote(notes.map(note => ({ note, top: note.pageNumber + note.yPercent, bottom: note.pageNumber + note.yPercent })), centerPosition);
}
