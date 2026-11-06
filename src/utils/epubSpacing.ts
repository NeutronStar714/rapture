const COLLAPSED_SPACE = 'data-epub-collapsed-space';
const blank = /^[\s\u200B\uFEFF]*$/u;
const spacerMarkup = 'br, span, b, i, strong, em, u, s, small, sub, sup, bdi, bdo';

function isSpacerParagraph(paragraph: Element): boolean {
  return blank.test(paragraph.textContent ?? '') && !paragraph.hasAttribute('id')
    && !paragraph.querySelector('[id]') && [...paragraph.querySelectorAll('*')].every(child => child.matches(spacerMarkup));
}

function collapseParagraphs(parent: ParentNode) {
  let hasParagraph = false;
  let run: Element[] = [];
  const runs: { rows: Element[]; betweenParagraphs: boolean }[] = [];
  const finishRun = (nextParagraph: boolean) => {
    const betweenParagraphs = hasParagraph && nextParagraph;
    if (run.length || betweenParagraphs) runs.push({ rows: run, betweenParagraphs });
    run = [];
    hasParagraph = nextParagraph;
  };

  for (const node of parent.childNodes) {
    if (node.nodeType === Node.COMMENT_NODE || (node.nodeType === Node.TEXT_NODE && blank.test(node.textContent ?? ''))) continue;
    if (!(node instanceof Element) || node.localName !== 'p') finishRun(false);
    else if (isSpacerParagraph(node)) run.push(node);
    else finishRun(true);
  }
  finishRun(false);

  // A repeated, uniform gap is likely paragraph padding from conversion. A larger
  // or isolated gap can be a scene break, so leave one spacer row in that case.
  const frequency = new Map<number, number>();
  let gaps = 0;
  for (const { rows, betweenParagraphs } of runs) {
    if (!betweenParagraphs) continue;
    gaps++;
    frequency.set(rows.length, (frequency.get(rows.length) ?? 0) + 1);
  }
  const baseline = [...frequency].find(([size, count]) => size > 0 && count >= 3 && count >= gaps * 0.75)?.[0] ?? 0;
  for (const { rows, betweenParagraphs } of runs) {
    const keep = betweenParagraphs && baseline && rows.length <= baseline ? 0 : 1;
    for (const row of rows.slice(keep)) row.setAttribute(COLLAPSED_SPACE, '');
  }
}

/** Collapse visual padding without removing the text used by saved note offsets. */
export function collapseEpubSpacers(chapter: DocumentFragment) {
  const parents = new Set<ParentNode>();
  for (const paragraph of chapter.querySelectorAll('p')) {
    if (!paragraph.closest('pre, table') && paragraph.parentNode) parents.add(paragraph.parentNode);
  }
  for (const parent of parents) collapseParagraphs(parent);

  parents.clear();
  for (const br of chapter.querySelectorAll('br')) {
    if (!br.closest('pre, table') && br.parentNode) parents.add(br.parentNode);
  }
  for (const parent of parents) {
    let breaks = 0;
    for (const node of parent.childNodes) {
      if (node instanceof Element && node.localName === 'br' && !node.hasAttribute('id')) {
        if (++breaks > 2) node.setAttribute(COLLAPSED_SPACE, '');
      } else if (node.nodeType !== Node.COMMENT_NODE && !(node.nodeType === Node.TEXT_NODE && blank.test(node.textContent ?? ''))) {
        breaks = 0;
      }
    }
  }
}
