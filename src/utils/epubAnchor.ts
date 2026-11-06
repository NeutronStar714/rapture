interface TextAnchor { node: Text; offset: number; }
export interface EpubAnchor {
  glyph?: TextAnchor;
  block?: { node: HTMLElement; fraction: number };
}
export interface SavedEpubAnchor { chapter: string; offset: number; }

export function centerY(viewport: HTMLElement) {
  return viewport.getBoundingClientRect().top + viewport.clientTop + viewport.clientHeight / 2;
}

function glyphRect(node: Text, offset: number) {
  if (!node.length || !node.isConnected) return undefined;
  const start = Math.min(offset, node.length - 1);
  const range = document.createRange();
  range.setStart(node, start);
  range.setEnd(node, Math.min(node.length, start + (node.data.codePointAt(start)! > 0xffff ? 2 : 1)));
  return [...range.getClientRects()].find(rect => rect.height > 0);
}

export function captureEpubAnchor(viewport: HTMLElement, content: HTMLElement, point?: { x: number; y: number }): EpubAnchor | undefined {
  const rect = viewport.getBoundingClientRect();
  const y = point?.y ?? centerY(viewport);
  const caretDoc = document as Document & { caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null };
  let nearest: TextAnchor | undefined;
  let distance = Infinity;
  for (const delta of [0, -12, 12, -24, 24, -48, 48]) {
    for (const x of [...(point ? [point.x] : []), ...[0.5, 0.25, 0.75].map(fraction => rect.left + viewport.clientWidth * fraction)]) {
      const line = y + delta;
      const position = caretDoc.caretPositionFromPoint?.(x, line);
      const fallback = position ? null : document.caretRangeFromPoint?.(x, line);
      const node = position?.offsetNode ?? fallback?.startContainer;
      if (node?.nodeType !== Node.TEXT_NODE || !content.contains(node)) continue;
      const offset = Math.min(position?.offset ?? fallback!.startOffset, (node as Text).length - 1);
      const glyph = glyphRect(node as Text, offset);
      if (!glyph) continue;
      const gap = Math.abs(glyph.top + glyph.height / 2 - y);
      if (gap < distance) { distance = gap; nearest = { node: node as Text, offset }; }
      if (gap <= 1) return { glyph: nearest };
    }
  }
  if (nearest && distance < 80) return { glyph: nearest };
  const block = document.elementFromPoint(rect.left + viewport.clientWidth / 2, y)?.closest<HTMLElement>('[data-epub-chapter], p, img, li, blockquote, h1, h2, h3');
  if (block && content.contains(block)) {
    const bounds = block.getBoundingClientRect();
    if (bounds.height) return { block: { node: block, fraction: Math.max(0, Math.min(1, (y - bounds.top) / bounds.height)) } };
  }
  return nearest && !point ? { glyph: nearest } : undefined;
}

export function anchorY(anchor: EpubAnchor) {
  if (anchor.glyph) {
    const rect = glyphRect(anchor.glyph.node, anchor.glyph.offset);
    return rect && rect.top + rect.height / 2;
  }
  if (anchor.block?.node.isConnected) {
    const rect = anchor.block.node.getBoundingClientRect();
    return rect.top + rect.height * anchor.block.fraction;
  }
}

export function saveEpubAnchor(anchor: EpubAnchor | undefined): SavedEpubAnchor | undefined {
  const glyph = anchor?.glyph;
  const chapter = (glyph?.node.parentElement ?? anchor?.block?.node)?.closest<HTMLElement>('[data-epub-chapter]');
  if (!chapter) return undefined;
  if (!glyph) return { chapter: chapter.id, offset: 0 };
  const range = document.createRange();
  range.selectNodeContents(chapter);
  range.setEnd(glyph.node, glyph.offset);
  return { chapter: chapter.id, offset: range.toString().length };
}

export function readEpubAnchor(content: HTMLElement, saved: SavedEpubAnchor): EpubAnchor | undefined {
  const chapter = [...content.querySelectorAll<HTMLElement>('[data-epub-chapter]')].find(section => section.id === saved.chapter);
  if (!chapter || !Number.isSafeInteger(saved.offset) || saved.offset < 0) return undefined;
  return readChapterGlyph(chapter, saved.offset) ?? { block: { node: chapter, fraction: 0 } };
}

export function readChapterGlyph(chapter: HTMLElement, offset: number): EpubAnchor | undefined {
  if (!Number.isSafeInteger(offset) || offset < 0) return undefined;
  const walker = document.createTreeWalker(chapter, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
    if (offset < node.length) {
      if (!node.parentElement?.closest('[data-epub-collapsed-space]')) return { glyph: { node, offset } };
      // Older notes can point into a spacer that no longer has a rendered glyph.
      for (let next = walker.nextNode() as Text | null; next; next = walker.nextNode() as Text | null) {
        const start = next.data.search(/[^\s\u200B\uFEFF]/u);
        if (start >= 0 && !next.parentElement?.closest('[data-epub-collapsed-space]')) return { glyph: { node: next, offset: start } };
      }
      walker.currentNode = node;
      for (let previous = walker.previousNode() as Text | null; previous; previous = walker.previousNode() as Text | null) {
        const end = previous.data.replace(/[\s\u200B\uFEFF]+$/u, '').length;
        if (end && !previous.parentElement?.closest('[data-epub-collapsed-space]')) return { glyph: { node: previous, offset: end - 1 } };
      }
      return;
    }
    offset -= node.length;
  }
}
