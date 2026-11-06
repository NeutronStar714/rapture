import React, { memo, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import type { EyelinerNote, ReadingTheme } from '../types';
import type { EpubBook } from '../utils/epub';
import { epubNoteRects } from '../utils/epubNotes';
import { nearestNote } from '../utils/nearestNote';
import { anchorY, captureEpubAnchor, centerY, readEpubAnchor, saveEpubAnchor, type EpubAnchor } from '../utils/epubAnchor';
import { centeredScrollTop, epubFontFamily, type EpubSettings } from '../utils/epubSettings';
import EpubOptions from './EpubOptions';

const Chapters = memo(function Chapters({ book }: { book: EpubBook }) {
  return <>{book.chapters.map((chapter, index) => <section key={chapter.id} id={chapter.id} data-epub-chapter data-page-number={index + 1} dangerouslySetInnerHTML={{ __html: chapter.html }} />)}</>;
});

export interface EpubControls {
  openOptions: () => void;
  jumpToChapter: (chapter: number) => void;
  scrollToNote: (note: EyelinerNote) => void;
  locateNearest: () => EyelinerNote | undefined;
}

interface Mark {
  id: string;
  highlight: boolean;
  left: number;
  top: number;
  width: number;
  height: number;
}

export default function EpubReader({
  book, fileName, theme, onTheme, settings, onSettingsChange, notes, eyelinerActive, highlighterActive, onPlaceEyeliner, onReadingPosition, controlsRef,
}: {
  book: EpubBook; fileName: string; theme: ReadingTheme; onTheme: (theme: ReadingTheme) => void;
  settings: EpubSettings; onSettingsChange: (settings: EpubSettings) => void;
  notes: EyelinerNote[]; eyelinerActive: boolean; highlighterActive: boolean;
  onPlaceEyeliner: (chapter: number, offset: number, progress: number) => void;
  onReadingPosition: (chapter: number, percent: number) => void;
  controlsRef: React.Ref<EpubControls>;
}) {
  const { size, font, lineHeight, align, margins } = settings;
  const [options, setOptions] = useState(false);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [hoverLine, setHoverLine] = useState<number>();
  const notesRef = useRef(notes);
  const viewport = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLElement>(null);
  const anchor = useRef<EpubAnchor | undefined>(undefined);
  const previousSettings = useRef(settings);
  const optionsOpen = useRef(false);
  const layout = useRef('');
  const restoredScrollTop = useRef<number | null>(null);
  const positionKey = `rapture_epub_position_${fileName}`;
  const layoutKey = () => {
    const el = viewport.current;
    return el ? `${el.clientWidth}/${el.clientHeight}/${el.scrollHeight}` : '';
  };
  const reportReadingPosition = () => {
    const el = viewport.current;
    const current = anchor.current;
    const section = (current?.glyph?.node.parentElement ?? current?.block?.node)?.closest<HTMLElement>('[data-epub-chapter]');
    if (!el || !section?.isConnected) return;
    const chapter = Number(section.dataset.pageNumber);
    const length = book.chapters[chapter - 1].text.length;
    const offset = current?.glyph && saveEpubAnchor(current)?.offset;
    let fraction = offset !== undefined && length > 0 ? offset / length : 0;
    if (offset === undefined) {
      const bounds = section.getBoundingClientRect();
      fraction = (centerY(el) - bounds.top) / Math.max(1, bounds.height);
    }
    const end = el.scrollHeight - el.clientHeight;
    const percent = chapter === 1 && el.scrollTop < 1 ? 0
      : chapter === book.chapters.length && end > 1 && el.scrollTop >= end - 1 ? 100
        : Math.round(100 * Math.max(0, Math.min(1, fraction)));
    onReadingPosition(chapter, percent);
  };
  const remember = () => {
    if (!viewport.current || !content.current || optionsOpen.current) return;
    anchor.current = captureEpubAnchor(viewport.current, content.current) ?? anchor.current;
    reportReadingPosition();
  };
  const persist = () => {
    try {
      const saved = saveEpubAnchor(anchor.current);
      if (saved) localStorage.setItem(positionKey, JSON.stringify(saved));
    } catch { /* Reading is still available if browser storage is full. */ }
  };
  const restore = () => {
    const el = viewport.current;
    const y = anchor.current && anchorY(anchor.current);
    if (!el || y === undefined) return;
    el.scrollTop = centeredScrollTop(el.scrollTop, centerY(el), y);
    restoredScrollTop.current = el.scrollTop;
    layout.current = layoutKey();
    reportReadingPosition();
  };

  const updateMarks = () => {
    const article = content.current;
    if (!article) return;
    const bounds = article.getBoundingClientRect();
    setMarks(notesRef.current.flatMap(note => epubNoteRects(article, note).map((rect, index) => ({
      id: note.id + ':' + index,
      highlight: !!note.highlight,
      left: rect.left - bounds.left,
      top: rect.top - bounds.top,
      width: rect.width,
      height: rect.height,
    }))));
  };

  useLayoutEffect(() => {
    notesRef.current = notes;
    updateMarks();
  }, [notes, size, font, lineHeight, align, margins, book]);
  useLayoutEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(positionKey) ?? 'null');
      if (saved && content.current) anchor.current = readEpubAnchor(content.current, saved);
    } catch { /* A missing position starts at the beginning of the book. */ }
    restore();
    layout.current = layoutKey();
    remember();
  }, [book, positionKey]);

  useLayoutEffect(() => {
    const previous = previousSettings.current;
    previousSettings.current = settings;
    if (previous.size !== size || previous.font !== font || previous.lineHeight !== lineHeight || previous.align !== align || previous.margins !== margins) {
      restore();
      layout.current = layoutKey();
    }
  }, [settings]);

  useEffect(() => {
    const el = viewport.current;
    if (!el || !content.current) return;
    let saveTimer: ReturnType<typeof setTimeout>;
    const onScroll = () => {
      setHoverLine(undefined);
      // ResizeObserver runs after reflow. Keep the pre-reflow anchor until it runs.
      if (layoutKey() !== layout.current || optionsOpen.current) return;
      // Ignore our own scroll, but capture a real scroll even during a resize burst.
      if (restoredScrollTop.current !== null && Math.abs(el.scrollTop - restoredScrollTop.current) < 1) return;
      restoredScrollTop.current = null;
      remember();
      clearTimeout(saveTimer);
      saveTimer = setTimeout(persist, 160);
    };
    const observer = new ResizeObserver(() => {
      updateMarks();
      setHoverLine(undefined);
      const key = layoutKey();
      if (key === layout.current) return;
      restore();
      layout.current = layoutKey();
    });
    observer.observe(el);
    observer.observe(content.current);
    el.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('beforeunload', persist);
    return () => {
      persist();
      clearTimeout(saveTimer);
      observer.disconnect();
      el.removeEventListener('scroll', onScroll);
      window.removeEventListener('beforeunload', persist);
    };
  }, [book, positionKey]);

  const jumpTo = (id: string) => {
    const target = document.getElementById(id);
    if (!target || !content.current?.contains(target)) return;
    target.scrollIntoView({ behavior: 'instant', block: 'start' });
    remember();
    persist();
  };

  useImperativeHandle(controlsRef, () => ({
    openOptions: () => {
      remember();
      optionsOpen.current = true;
      setOptions(true);
    },
    jumpToChapter: chapter => {
      const target = book.chapters[chapter - 1];
      if (target) jumpTo(target.id);
    },
    scrollToNote: note => {
      const el = viewport.current;
      const article = content.current;
      if (!el || !article) return;
      const rect = epubNoteRects(article, note)[0];
      if (!rect) return;
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      el.scrollTo({
        top: centeredScrollTop(el.scrollTop, centerY(el), rect.top + rect.height / 2),
        behavior: reduceMotion ? 'instant' : 'smooth',
      });
    },
    locateNearest: () => {
      const el = viewport.current;
      const article = content.current;
      if (!el || !article) return undefined;
      return nearestNote(notesRef.current.flatMap(note => epubNoteRects(article, note)
        .map(rect => ({ note, top: rect.top, bottom: rect.bottom }))), centerY(el));
    },
  }));

  const anchorAt = (event: React.MouseEvent) => {
    const el = viewport.current;
    const article = content.current;
    if (!el || !article || !article.contains(event.target as Node)) return undefined;
    const hit = captureEpubAnchor(el, article, { x: event.clientX, y: event.clientY });
    return hit?.glyph ? hit : undefined;
  };

  return (
    <div className="epub-reader relative flex-1 w-full min-h-0 overflow-hidden" data-reading-theme={theme}>
      <div ref={viewport} id="epub-view-scroll-container"
        className={`epub-viewport h-full overflow-auto select-text ${highlighterActive ? 'highlighter-active' : ''} ${eyelinerActive ? 'epub-eyeliner-active' : ''}`}
        aria-label="Document viewer" tabIndex={0}
        onMouseLeave={() => setHoverLine(undefined)}
        onMouseMove={event => {
          if (!eyelinerActive) return;
          const hit = anchorAt(event);
          const y = hit && anchorY(hit);
          setHoverLine(y === undefined ? undefined : y - event.currentTarget.getBoundingClientRect().top);
        }}
        onClick={event => {
          const link = (event.target as Element).closest<HTMLAnchorElement>('a[href^="#epub-chapter-"]');
          if (link) event.preventDefault();
          if (eyelinerActive) {
            const saved = saveEpubAnchor(anchorAt(event));
            const chapter = saved && book.chapters.findIndex(item => item.id === saved.chapter);
            if (saved && chapter !== undefined && chapter >= 0) {
              onPlaceEyeliner(chapter + 1, saved.offset, saved.offset / Math.max(1, book.chapters[chapter].text.length));
            }
          } else if (link && !highlighterActive) {
            jumpTo(link.getAttribute('href')!.slice(1));
          }
        }}>
        <article ref={content} lang={book.language || undefined} className="epub-content relative" style={{
          fontSize: size, fontFamily: epubFontFamily(font), lineHeight,
          textAlign: align, paddingInline: margins,
        }}>
          <Chapters book={book} />
          <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
            {marks.map(({ id, highlight, ...style }) => (
              <div key={id} className={highlight ? 'epub-highlight' : 'epub-eyeliner'} style={style} />
            ))}
          </div>
        </article>
      </div>
      {eyelinerActive && hoverLine !== undefined && <div className="epub-eyeliner epub-eyeliner-preview" style={{ top: hoverLine }} aria-hidden="true" />}
      {options && <EpubOptions settings={settings} onChange={onSettingsChange} theme={theme} onTheme={onTheme} onClose={() => {
        optionsOpen.current = false; setOptions(false); requestAnimationFrame(remember);
      }} />}
    </div>
  );
}
