export const DOCUMENT_ACCEPT = '.pdf,.epub,application/pdf,application/epub+zip';
export function documentKind(name: string, mime = ''): 'pdf' | 'epub' | undefined {
  if (/\.epub$/i.test(name) || mime === 'application/epub+zip') return 'epub';
  if (/\.pdf$/i.test(name) || mime === 'application/pdf') return 'pdf';
}

/** Resolve an EPUB link in the ZIP namespace, never against the app or the network. */
export function resolveEpubLink(base: string, href: string): { path: string; fragment: string } | undefined {
  try {
    const [file, ...hash] = href.trim().split('#');
    const fragment = decodeURIComponent(hash.join('#'));
    const target = decodeURIComponent(file.split('?')[0]);
    if (/^(?:[a-z][a-z\d+.-]*:|\/)/i.test(target) || /[\\\x00-\x1F]/.test(target)) return;
    if (!target) return { path: base, fragment };
    const parts = base.split('/').slice(0, -1);
    for (const part of target.split('/')) {
      if (!part || part === '.') continue;
      if (part === '..') { if (!parts.length) return; parts.pop(); }
      else parts.push(part);
    }
    return { path: parts.join('/'), fragment };
  } catch { /* Broken percent escapes are not valid archive references. */ }
}
