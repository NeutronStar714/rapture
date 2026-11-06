import { test } from 'node:test';
import assert from 'node:assert/strict';
import { documentKind, resolveEpubLink } from '../src/utils/documentKind.ts';
import { centeredScrollTop, DEFAULT_EPUB_SETTINGS, epubFontFamily, readEpubSettings } from '../src/utils/epubSettings.ts';

test('library dispatch recognizes PDFs and EPUBs with or without MIME metadata', () => {
  assert.equal(documentKind('book.EPUB'), 'epub');
  assert.equal(documentKind('notes.PDF'), 'pdf');
  assert.equal(documentKind('untitled', 'application/epub+zip'), 'epub');
  assert.equal(documentKind('notes.md'), undefined);
});

test('EPUB links resolve relative to the chapter inside the archive', () => {
  assert.deepEqual(resolveEpubLink('OPS/text/a.xhtml', '../images/My%20Cover.jpg'), { path: 'OPS/images/My Cover.jpg', fragment: '' });
  assert.deepEqual(resolveEpubLink('OPS/text/a.xhtml', '#note%201'), { path: 'OPS/text/a.xhtml', fragment: 'note 1' });
  assert.deepEqual(resolveEpubLink('OPS/text/a.xhtml', 'b.xhtml#second'), { path: 'OPS/text/b.xhtml', fragment: 'second' });
});

test('EPUB resource resolver rejects network, external paths, and traversal outside the archive', () => {
  for (const href of ['https://outside.invalid/cover.png', '//outside.invalid/x', '/outside.png', '%2Foutside.png', 'javascript:alert(1)', 'C:\\image.png', '../../../../outside.png', '%zz']) {
    assert.equal(resolveEpubLink('OPS/chapter.xhtml', href), undefined, href);
  }
});

test('reading defaults and saved font families survive a settings round trip', () => {
  assert.deepEqual(readEpubSettings(null), DEFAULT_EPUB_SETTINGS);
  assert.equal(DEFAULT_EPUB_SETTINGS.size, 30);
  const settings = readEpubSettings('{"size":42,"font":"Microsoft YaHei","align":"start","lineHeight":1.8,"margins":16}');
  assert.deepEqual(settings, { size: 42, font: 'Microsoft YaHei', align: 'start', lineHeight: 1.8, margins: 16, showChapterProgress: true });
  assert.equal(readEpubSettings('{"showChapterProgress":false}').showChapterProgress, false);
  assert.equal(readEpubSettings('{"showChapterProgress":"false"}').showChapterProgress, true);
  assert.equal(readEpubSettings('{"size":999,"font":" "}').size, 60);
  assert.equal(epubFontFamily('Family "A"'), '"Family \\"A\\"", Georgia, serif');
});

test('reflow restores the previous glyph to the new viewer center', () => {
  const initialScroll = 800;
  const anchorAfterReflow = 640;
  const newCenter = 300;
  const restored = centeredScrollTop(initialScroll, newCenter, anchorAfterReflow);
  assert.equal(restored, 1140);
  assert.equal(anchorAfterReflow - (restored - initialScroll), newCenter);
  assert.equal(centeredScrollTop(20, 300, 100), 0);
});
