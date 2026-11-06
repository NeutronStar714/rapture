import { unzipSync } from 'fflate';
import DOMPurify from 'dompurify';
import { resolveEpubLink } from './documentKind';
import { collapseEpubSpacers } from './epubSpacing';

export interface EpubChapter { id: string; title: string; html: string; text: string; }
interface EpubCover { coverUrl?: string; coverText?: string; }
export interface EpubBook { title: string; language: string; chapters: EpubChapter[]; cover: Promise<EpubCover>; dispose: () => void; }
const MB = 1024 * 1024;
const elements = (node: Document | Element, name: string) => [...node.getElementsByTagNameNS('*', name)];
const rasterTypes: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif' };

function decode(bytes: Uint8Array) {
  const encoding = bytes[0] === 0xff && bytes[1] === 0xfe ? 'utf-16le' : bytes[0] === 0xfe && bytes[1] === 0xff ? 'utf-16be' : 'utf-8';
  return new TextDecoder(encoding).decode(bytes);
}

function openEpub(data: ArrayBuffer) {
  if (data.byteLength > 128 * MB) throw new Error('This EPUB is too large to open.');
  let total = 0;
  const files = unzipSync(new Uint8Array(data), { filter: entry => {
    if (entry.originalSize > 32 * MB || (total += entry.originalSize) > 192 * MB) throw new Error('This EPUB expands beyond the reader’s size limit.');
    return !entry.name.endsWith('/');
  } });
  const file = (path: string) => Object.hasOwn(files, path) ? files[path] : undefined;
  const read = (path: string) => {
    const bytes = file(path);
    if (!bytes) throw new Error(`Missing EPUB content: ${path}`);
    return decode(bytes);
  };
  const xml = (path: string) => {
    const doc = new DOMParser().parseFromString(read(path), 'application/xml');
    if (elements(doc, 'parsererror').length) throw new Error(`Invalid EPUB metadata: ${path}`);
    return doc;
  };
  const container = xml('META-INF/container.xml');
  const rootFile = elements(container, 'rootfile')[0]?.getAttribute('full-path');
  const packagePath = rootFile && resolveEpubLink('', rootFile)?.path;
  if (!packagePath) throw new Error('This EPUB does not declare a book package.');
  const opf = xml(packagePath);
  const manifest = new Map(elements(opf, 'item').map(item => [item.getAttribute('id'), item]));
  const spine = elements(opf, 'spine')[0];
  const packageLink = (href: string | null | undefined) => href ? resolveEpubLink(packagePath, href)?.path : undefined;
  const itemPath = (item: Element | undefined) => packageLink(item?.getAttribute('href'));
  const spineItems = (spine ? elements(spine, 'itemref') : []).flatMap(ref => {
    const path = itemPath(manifest.get(ref.getAttribute('idref')));
    return path ? [{ path, linear: ref.getAttribute('linear') !== 'no' }] : [];
  });
  const metadata = elements(opf, 'metadata')[0];
  const declared = [...manifest.values()].find(item => item.getAttribute('properties')?.split(/\s+/).includes('cover-image'));
  const legacyId = metadata && elements(metadata, 'meta').find(meta => meta.getAttribute('name') === 'cover')?.getAttribute('content');
  const guide = elements(opf, 'guide')[0];
  const guideCover = guide && elements(guide, 'reference').find(ref => ref.getAttribute('type') === 'cover');
  const coverPaths = [itemPath(declared), itemPath(manifest.get(legacyId)), packageLink(guideCover?.getAttribute('href'))];
  const mediaTypes = new Map([...manifest.values()].flatMap(item => {
    const path = itemPath(item);
    const type = item.getAttribute('media-type');
    return path && type ? [[path, type] as const] : [];
  }));
  return { file, read, spineItems, metadata, coverPaths, mediaTypes };
}

export function readEpub(data: ArrayBuffer, fileName: string): EpubBook {
  const epub = openEpub(data);
  const { file, read, metadata } = epub;
  const paths = epub.spineItems.filter(item => item.linear).map(item => item.path);
  if (!paths.length) throw new Error('This EPUB has no readable chapters.');
  const chapterIds = new Map(paths.map((path, i) => [path, `epub-chapter-${i + 1}`]));
  const imageUrls = new Map<string, string>();
  const dispose = () => { for (const url of imageUrls.values()) URL.revokeObjectURL(url); imageUrls.clear(); };
  const imageUrl = (path: string) => {
    const type = rasterTypes[path.split('.').pop()?.toLowerCase() ?? ''];
    const bytes = file(path);
    if (!type || !bytes) return undefined;
    if (!imageUrls.has(path)) imageUrls.set(path, URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type })));
    return imageUrls.get(path);
  };

  try {
    const chapters = paths.map((path, i) => {
      const id = `epub-chapter-${i + 1}`;
      // Keep book markup inert until it has been sanitized and all resource URLs rewritten.
      const template = document.createElement('template');
      template.innerHTML = read(path);
      template.content.querySelectorAll('head,title,script,style,link,meta,base,iframe,object,embed').forEach(node => node.remove());
      // A common EPUB cover uses an SVG wrapper around a raster image.
      for (const svg of template.content.querySelectorAll('svg')) {
        const image = svg.querySelector('image');
        const src = image?.getAttribute('href') || image?.getAttribute('xlink:href');
        if (!src) continue;
        const img = template.content.ownerDocument.createElement('img');
        img.setAttribute('src', src);
        img.setAttribute('alt', svg.getAttribute('aria-label') || 'Book illustration');
        svg.replaceWith(img);
      }
      for (const img of template.content.querySelectorAll('img')) {
        const src = resolveEpubLink(path, img.getAttribute('src') ?? '');
        img.removeAttribute('src');
        img.removeAttribute('srcset');
        img.removeAttribute('data-epub-resource');
        if (src) img.setAttribute('data-epub-resource', src.path);
      }
      const safe = DOMPurify.sanitize(template.content, {
        RETURN_DOM_FRAGMENT: true,
        ALLOWED_TAGS: ['article','section','div','span','p','br','hr','a','em','strong','b','i','u','s','small','sub','sup','h1','h2','h3','h4','h5','h6','ul','ol','li','dl','dt','dd','blockquote','pre','code','img','figure','figcaption','table','thead','tbody','tr','th','td','ruby','rt','rp','bdi','bdo'],
        ALLOWED_ATTR: ['id','href','data-epub-resource','alt','lang','dir','colspan','rowspan','start','title'],
        ALLOW_DATA_ATTR: false, ALLOW_ARIA_ATTR: false,
      });
      for (const node of safe.querySelectorAll('[id]')) node.id = `${id}-${encodeURIComponent(node.id)}`;
      for (const img of safe.querySelectorAll('img')) {
        const src = img.getAttribute('data-epub-resource');
        img.removeAttribute('data-epub-resource');
        const url = src && imageUrl(src);
        if (url) img.setAttribute('src', url);
        else img.removeAttribute('src');
      }
      for (const anchor of safe.querySelectorAll('a[href]')) {
        const target = resolveEpubLink(path, anchor.getAttribute('href') ?? '');
        const chapter = target && (target.path === path ? id : chapterIds.get(target.path));
        if (chapter && target) anchor.setAttribute('href', '#' + chapter + (target.fragment ? '-' + encodeURIComponent(target.fragment) : ''));
        else anchor.removeAttribute('href');
      }
      const title = safe.querySelector('h1,h2,h3,h4,h5,h6')?.textContent?.trim() || `Chapter ${i + 1}`;
      const text = safe.textContent ?? '';
      collapseEpubSpacers(safe);
      template.content.replaceChildren(safe);
      return { id, title, html: template.innerHTML, text };
    });
    return {
      title: (metadata && elements(metadata, 'title')[0]?.textContent?.trim()) || fileName.replace(/\.epub$/i, ''),
      language: (metadata && elements(metadata, 'language')[0]?.textContent?.trim()) || '',
      chapters, dispose, cover: makeEpubCover(epub),
    };
  } catch (error) { dispose(); throw error; }
}

export function readEpubCover(data: ArrayBuffer): Promise<EpubCover> {
  return makeEpubCover(openEpub(data));
}

async function makeEpubCover(epub: ReturnType<typeof openEpub>): Promise<EpubCover> {
  const first = epub.spineItems[0]?.path;
  let coverText = '';
  for (const path of new Set([...epub.coverPaths, first])) {
    if (!path) continue;
    const bytes = epub.file(path);
    if (!bytes) continue;
    const type = epub.mediaTypes.get(path) ?? rasterTypes[path.split('.').pop()?.toLowerCase() ?? ''] ?? (path.endsWith('.svg') ? 'image/svg+xml' : '');
    const supportedImage = type === 'image/svg+xml' || Object.values(rasterTypes).includes(type);
    const sources: Blob[] = [];
    if (!supportedImage || type === 'image/svg+xml') {
      // Keep page markup inert. Only local archive images and plain text can become a card.
      const page = document.createElement('template');
      page.innerHTML = decode(bytes);
      page.content.querySelectorAll('head,title,script,style,link,meta,base,iframe,object,embed').forEach(node => node.remove());
      for (const image of [...page.content.querySelectorAll('img, svg image')].slice(0, 8)) {
        const href = image.getAttribute('src') ?? image.getAttribute('href') ?? image.getAttribute('xlink:href');
        const imagePath = href && resolveEpubLink(path, href)?.path;
        if (!imagePath) continue;
        const imageType = epub.mediaTypes.get(imagePath) ?? rasterTypes[imagePath.split('.').pop()?.toLowerCase() ?? ''];
        const imageBytes = epub.file(imagePath);
        if (imageBytes && (imageType === 'image/svg+xml' || Object.values(rasterTypes).includes(imageType))) {
          sources.push(new Blob([new Uint8Array(imageBytes)], { type: imageType }));
        }
      }
      if (path === first) {
        page.content.querySelectorAll('h1,h2,h3,h4,h5,h6,p,br,li').forEach(node => node.after(' '));
        coverText = (page.content.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 560);
      }
    }
    if (supportedImage) sources.push(new Blob([new Uint8Array(bytes)], { type }));
    for (const source of sources) {
      const coverUrl = await coverThumbnail(source);
      if (coverUrl) return { coverUrl };
    }
  }
  return { coverText };
}

async function coverThumbnail(source: Blob): Promise<string | undefined> {
  const url = URL.createObjectURL(source);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (!image.naturalWidth || !image.naturalHeight) return;
    const scale = Math.min(1, 280 / image.naturalWidth, 380 / image.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.78);
  } catch { /* Try the next cover candidate if an image cannot be decoded. */ }
  finally { URL.revokeObjectURL(url); }
}
