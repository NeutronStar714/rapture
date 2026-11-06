export interface EpubSettings {
  size: number;
  font: string;
  align: 'justify' | 'start';
  lineHeight: number;
  margins: number;
  showChapterProgress: boolean;
}
export const EPUB_SETTINGS_KEY = 'rapture_epub_settings';
export const DEFAULT_EPUB_SETTINGS: EpubSettings = { size: 30, font: 'Georgia', align: 'justify', lineHeight: 1.55, margins: 24, showChapterProgress: true };
const clamp = (n: unknown, min: number, max: number, fallback: number) => typeof n === 'number' && Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
export function readEpubSettings(raw: string | null): EpubSettings {
  const defaults = DEFAULT_EPUB_SETTINGS;
  try {
    const saved = JSON.parse(raw ?? '{}');
    return {
      size: clamp(saved?.size, 12, 60, defaults.size),
      font: typeof saved?.font === 'string' ? saved.font.replace(/[\x00-\x1f\x7f]/g, '').trim().slice(0, 160) || defaults.font : defaults.font,
      align: saved?.align === 'start' ? 'start' : defaults.align,
      lineHeight: clamp(saved?.lineHeight, 1.2, 2, defaults.lineHeight),
      margins: clamp(saved?.margins, 8, 64, defaults.margins),
      showChapterProgress: typeof saved?.showChapterProgress === 'boolean' ? saved.showChapterProgress : defaults.showChapterProgress,
    };
  } catch { return { ...defaults }; }
}
export function epubFontFamily(font: string) {
  return `"${font.replace(/[\\"]/g, '\\$&')}", Georgia, serif`;
}

/** Positive values move the viewport downward, bringing the saved glyph to its center. */
export function centeredScrollTop(scrollTop: number, viewportCenter: number, anchorY: number) {
  return Math.max(0, scrollTop + anchorY - viewportCenter);
}
