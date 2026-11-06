import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nearestNote, locateNearestNote } from '../src/utils/nearestNote.ts';

const first = { id: 'first', pageNumber: 1, yPercent: 0.1 };
const middle = { id: 'middle', pageNumber: 1, yPercent: 0.5 };
const last = { id: 'last', pageNumber: 1, yPercent: 0.9 };

test('multiple notes on one page are selected by vertical position', () => {
  const positions = [first, middle, last].map(note => ({ note, top: note.yPercent * 1000, bottom: note.yPercent * 1000 }));
  assert.equal(nearestNote(positions, 490), middle);
  assert.equal(nearestNote(positions, 850), last);
  assert.equal(nearestNote(positions, 120), first);
});

test('the live viewer center changes the nearest note as the page scrolls', () => {
  let pageTop = 0;
  const page = { getBoundingClientRect: () => ({ top: pageTop, height: 1000 }), querySelector: () => null };
  const viewer = { getBoundingClientRect: () => ({ top: 100 }), clientTop: 0, clientHeight: 600, querySelector: () => page };
  assert.equal(locateNearestNote([first, middle, last], viewer, 1), middle);
  pageTop = -450;
  assert.equal(locateNearestNote([first, middle, last], viewer, 1), last);
});

test('actual page geometry takes priority over the current page indicator', () => {
  const otherPage = { ...last, id: 'page2', pageNumber: 2 };
  const pages = {
    '#pdf-page-container-1': { getBoundingClientRect: () => ({ top: -900, height: 1000 }), querySelector: () => null },
    '#pdf-page-container-2': { getBoundingClientRect: () => ({ top: 120, height: 1000 }), querySelector: () => null },
  };
  const viewer = { getBoundingClientRect: () => ({ top: 0 }), clientTop: 0, clientHeight: 800, querySelector: selector => pages[selector] };
  assert.equal(locateNearestNote([first, otherPage], viewer, 1), otherPage);
});

test('a highlight crossing the center beats a nearby mark; gaps between highlight lines are respected', () => {
  assert.equal(nearestNote([{ note: first, top: 390, bottom: 390 }, { note: middle, top: 380, bottom: 420 }], 400), middle);
  assert.equal(nearestNote([{ note: first, top: 100, bottom: 120 }, { note: first, top: 500, bottom: 520 }, { note: middle, top: 310, bottom: 310 }], 300), middle);
  assert.equal(nearestNote([], 400), undefined);
});
