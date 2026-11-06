import type { SearchMatch } from '../types.ts';

const han = /\p{Script=Han}/u;
const hanGap = /(\p{Script=Han})[\s\u200B]+(?=\p{Script=Han})/gu;
const escapePattern = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : undefined;

function searchPattern(query: string): RegExp | undefined {
  const characters = [...query.normalize('NFKC').trim().replace(hanGap, '$1')];
  if (!characters.length) return undefined;
  // PDF.js text runs are joined with spaces, even when a word is split across runs.
  const pattern = characters.map((char, i) =>
    (i && han.test(char) && han.test(characters[i - 1]) ? '[\\s\\u200B]*' : '') + escapePattern(char),
  ).join('');
  return new RegExp(pattern, 'giu');
}

/** NFKC can expand a ligature or compose several code points into one character. */
function sourceOffsets(text: string): { start: number; end: number }[] {
  const offsets: { start: number; end: number }[] = [];
  const spans = /[\p{M}\u1100-\u11FF\uA960-\uA97F\uD7B0-\uD7FF]/u.test(text)
    ? segmenter ? Array.from(segmenter.segment(text), part => part.segment) : text.match(/\P{M}\p{M}*|\p{M}+/gu) ?? []
    : text;
  let index = 0;
  for (const span of spans) {
    const bounds = { start: index, end: index + span.length };
    for (let i = 0; i < span.normalize('NFKC').length; i++) offsets.push(bounds);
    index = bounds.end;
  }
  return offsets;
}

export function searchPdfText(textByPage: Record<number, string>, query: string): SearchMatch[] {
  const pattern = searchPattern(query);
  if (!pattern) return [];

  const matches: SearchMatch[] = [];
  for (const [page, text] of Object.entries(textByPage)) {
    // Kangxi radicals (e.g. ⾃, ⾝, ⼝), compatibility ideographs, and width variants
    // have Unicode compatibility mappings. Fold the query and PDF text alike.
    const normalized = text.normalize('NFKC');
    pattern.lastIndex = 0;
    let offsets: ReturnType<typeof sourceOffsets> | undefined;
    for (let match = pattern.exec(normalized); match; match = pattern.exec(normalized)) {
      if (normalized !== text) offsets ??= sourceOffsets(text);
      const index = offsets?.[match.index]?.start ?? match.index;
      const matchEnd = match.index + match[0].length;
      const end = offsets?.[matchEnd - 1]?.end ?? matchEnd;
      const snippetStart = Math.max(0, index - 40);
      const snippetEnd = Math.min(text.length, end + 40);
      const prefix = snippetStart > 0 ? '...' : '';
      const suffix = snippetEnd < text.length ? '...' : '';
      matches.push({
        pageNumber: Number(page), index,
        snippet: prefix + text.slice(snippetStart, snippetEnd) + suffix,
        snippetMatchStart: prefix.length + index - snippetStart,
        snippetMatchEnd: prefix.length + end - snippetStart,
      });
      // Keep overlapping matches, but advance by a whole Unicode code point.
      pattern.lastIndex = match.index + (normalized.codePointAt(match.index)! > 0xFFFF ? 2 : 1);
    }
  }
  return matches;
}
