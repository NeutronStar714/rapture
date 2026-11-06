import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toggleHighlights, moveHighlight, parseNote } from '../src/utils/highlights.ts';
import { NotePersistence } from '../src/utils/notePersistence.ts';

let id = 0;
const toggle = (notes, start, end, pageNumber = 1) => toggleHighlights(notes, { start, end, pageNumber, yAt: offset => offset / 100 }, () => `new-${++id}`);
const intervals = notes => notes.filter(n => n.highlight).map(n => [n.highlight.start, n.highlight.end]);
const line = { id: 'line', pageNumber: 1, yPercent: 0.2, text: 'Eyeliner', timestamp: 1 };

test('drag adds a blank deck note; repeating the same drag removes it', () => {
  const added = toggle([line], 10, 30);
  assert.deepEqual(intervals(added), [[10, 30]]);
  assert.equal(added[1].text, '');
  assert.deepEqual(toggle(added, 10, 30), [line]);
});

test('removing the middle splits one highlight into two distinct notes with the original comment', () => {
  const original = toggle([], 0, 30).map(n => ({ ...n, text: 'Keep this comment' }));
  const split = toggle(original, 10, 20);
  assert.deepEqual(intervals(split), [[0, 10], [20, 30]]);
  assert.equal(new Set(split.map(n => n.id)).size, 2);
  assert.ok(split.every(n => n.text === 'Keep this comment'));
  assert.deepEqual(split.map(n => n.yPercent), [0, 0.2]);
});

test('bridging adjacent ranges joins notes and preserves both comments', () => {
  let notes = toggle([], 0, 10).map(n => ({ ...n, text: 'First' }));
  notes = toggle(notes, 20, 30).map(n => ({ ...n, text: n.text || 'Second' }));
  const merged = toggle(notes, 10, 20);
  assert.deepEqual(intervals(merged), [[0, 30]]);
  assert.equal(merged[0].text, 'First\nSecond');
});

test('mixed selections invert each character and leave other pages and Eyeliner notes alone', () => {
  const secondPage = toggle([], 0, 20, 2);
  const result = toggle([...toggle([], 10, 30), ...secondPage, line], 20, 40);
  assert.deepEqual(intervals(result.filter(n => n.pageNumber === 1)), [[10, 20], [30, 40]]);
  assert.ok(result.includes(line));
  assert.ok(result.includes(secondPage[0]));
});

test('range toggling matches character-by-character XOR across repeated arbitrary drags', () => {
  let notes = [], expected = Array(50).fill(false), seed = 7;
  const random = () => (seed = (seed * 1664525 + 1013904223) >>> 0) % 50;
  for (let i = 0; i < 150; i++) {
    const a = random(), b = random();
    const start = Math.min(a, b), end = Math.max(a, b) + 1;
    notes = toggle(notes, start, end);
    for (let j = start; j < end; j++) expected[j] = !expected[j];
    const actual = Array(50).fill(false);
    for (const n of notes) for (let j = n.highlight.start; j < n.highlight.end; j++) actual[j] = true;
    assert.deepEqual(actual, expected);
    const sorted = [...notes].sort((a, b) => a.highlight.start - b.highlight.start);
    for (let j = 1; j < sorted.length; j++) assert.ok(sorted[j - 1].highlight.end < sorted[j].highlight.start);
    assert.equal(new Set(notes.map(n => n.id)).size, notes.length);
  }
});

test('import supports old notes, keeps highlight anchors, rejects invalid ranges', () => {
  assert.deepEqual(parseNote(line), line);
  const highlight = toggle([], 3, 9)[0];
  assert.deepEqual(parseNote(JSON.parse(JSON.stringify(highlight))), highlight);
  for (const anchor of [{ start: -1, end: 3 }, { start: 3, end: 3 }, { start: 0, end: 1.5 }, { start: 0, end: Infinity }]) {
    assert.throws(() => parseNote({ ...highlight, highlight: anchor }));
  }
});

test('moving onto another highlight keeps both comments instead of toggling away the destination', () => {
  const source = toggle([], 0, 10).map(n => ({ ...n, text: 'Source' }));
  const destination = toggle([], 20, 30).map(n => ({ ...n, text: 'Destination' }));
  const moved = moveHighlight([...source, ...destination], source[0].id, [{ start: 20, end: 30, pageNumber: 1, yAt: () => 0.2 }]);
  assert.deepEqual(intervals(moved), [[20, 30]]);
  assert.equal(moved.length, 1);
  assert.match(moved[0].text, /Source/);
  assert.match(moved[0].text, /Destination/);
});

test('highlight deletion persists an empty list; anchors survive a saved session', async () => {
  const values = new Map(), writes = [];
  const session = new NotePersistence(async (_, notes) => writes.push(JSON.parse(JSON.stringify(notes))),
    { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }, () => {}, () => {});
  await session.activate('test.pdf');
  session.update(toggle([], 3, 9));
  await session.flush();
  await session.activate('test.pdf');
  assert.deepEqual(session.notes[0].highlight, { start: 3, end: 9 });
  session.update([]);
  await session.flush();
  assert.deepEqual(writes.at(-1), []);
});

test('EPUB highlights retain chapter offsets when split, moved, and imported', () => {
  const selection = (start, end, pageNumber = 1) => ({ start, end, pageNumber, epub: true, yAt: offset => offset / 100 });
  const pdf = toggle([], 0, 30)[0];
  const initial = toggleHighlights([pdf], selection(0, 30));
  assert.equal(initial[1].epubOffset, 0);
  const split = toggleHighlights(initial, selection(10, 20));
  assert.deepEqual(split.map(note => note.epubOffset), [undefined, 0, 20]);
  const moved = moveHighlight(split, split[1].id, [selection(40, 50, 2)]);
  const restored = JSON.parse(JSON.stringify(moved)).map(parseNote);
  assert.deepEqual(restored, moved);
  assert.deepEqual(restored.find(note => note.id === split[1].id), {
    ...split[1], pageNumber: 2, epubOffset: 40, yPercent: 0.4, highlight: { start: 40, end: 50 },
  });
});
