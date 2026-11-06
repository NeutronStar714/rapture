import type { TextHighlight } from '../types.ts';
import type { HighlightSelection } from './highlights.ts';

/** Read geometry one text node at a time; whole-span rects would include unselected glyphs. */
export function highlightRects(layer: HTMLElement, anchor: TextHighlight): DOMRect[] {
  const rects: DOMRect[] = [];
  const walker = document.createTreeWalker(layer, NodeFilter.SHOW_TEXT);
  let position = 0;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const length = node.textContent?.length ?? 0;
    const start = Math.max(0, anchor.start - position);
    const end = Math.min(length, anchor.end - position);
    if (start < end) {
      const range = document.createRange();
      range.setStart(node, start);
      range.setEnd(node, end);
      rects.push(...Array.from(range.getClientRects()).filter(r => r.width > 0 && r.height > 0));
    }
    position += length;
    if (position >= anchor.end) break;
  }
  // A different PDF may have less text. Do not draw a partial, misleading anchor.
  return position >= anchor.end ? rects : [];
}

export function readHighlightSelection(viewport: HTMLElement, selection: Selection, epub = false): HighlightSelection[] {
  if (selection.isCollapsed || !selection.rangeCount) return [];
  const selected = selection.getRangeAt(0);
  const result: HighlightSelection[] = [];
  for (const layer of viewport.querySelectorAll<HTMLElement>(epub ? '[data-epub-chapter]' : '.rapture-text-layer[data-page-number]')) {
    if (!selected.intersectsNode(layer)) continue;
    const clipped = document.createRange();
    clipped.selectNodeContents(layer);
    if (selected.compareBoundaryPoints(Range.START_TO_START, clipped) > 0) clipped.setStart(selected.startContainer, selected.startOffset);
    if (selected.compareBoundaryPoints(Range.END_TO_END, clipped) < 0) clipped.setEnd(selected.endContainer, selected.endOffset);
    if (clipped.collapsed || !clipped.toString().trim()) continue;
    const prefix = document.createRange();
    prefix.selectNodeContents(layer);
    prefix.setEnd(clipped.startContainer, clipped.startOffset);
    const start = prefix.toString().length;
    const end = start + clipped.toString().length;
    const pageNumber = Number(layer.dataset.pageNumber);
    const yAt = (offset: number) => {
      if (epub) return offset / Math.max(1, layer.textContent?.length ?? 0);
      const rect = highlightRects(layer, { start: offset, end: offset + 1 })[0];
      const bounds = layer.getBoundingClientRect();
      return rect && bounds.height ? Math.max(0, Math.min(1, (rect.top - bounds.top) / bounds.height)) : 0;
    };
    result.push({ start, end, pageNumber, yAt, epub });
  }
  return result;
}
