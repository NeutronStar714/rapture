import { test } from 'node:test';
import assert from 'node:assert/strict';
import { markdownNotes, readNotesSettings, DEFAULT_NOTES_SETTINGS as defaults } from '../src/utils/notesExport.ts';
import { noteCitations } from '../src/utils/noteCitations.ts';
const a = { id: 'a', pageNumber: 2, yPercent: 0.42, timestamp: 10, text: 'First note' };
const b = { id: 'b', pageNumber: 1, yPercent: 0.1, timestamp: 20, text: 'Second note', highlight: { start: 0, end: 5 } };
test('Markdown uses bold page, percentage and form, then text with a blank line between notes', () => {
  assert.equal(markdownNotes('doc.pdf', [a, b], defaults), '**P1** **10%** **Highlight**  \nSecond note\n\n**P2** **42%** **Eyeliner**  \nFirst note\n');
});
test('creation order, empty comments and optional heading are respected without changing source notes', () => {
  const notes = [a, b, { ...a, id: 'empty', text: '' }];
  const result = markdownNotes('doc.pdf', notes, { ...defaults, order: 'created', includeEmpty: false, documentTitle: true });
  assert.ok(result.startsWith('# doc.pdf\n\n**P2**'));
  assert.equal((result.match(/\*\*Eyeliner\*\*/g) ?? []).length, 1);
  assert.deepEqual(notes.map(n => n.id), ['a', 'b', 'empty']);
});
test('citations are optional, escaped and length limited', () => {
  const citations = { a: '*source*\ntext that is long' };
  assert.ok(!markdownNotes('doc', [a], defaults, citations).includes('>'));
  assert.ok(markdownNotes('doc', [a], { ...defaults, citations: true, citationLength: 8 }, citations).includes('> \\*source\\*'));
});
test('invalid preferences recover defaults and text size is constrained', () => {
  assert.deepEqual(readNotesSettings('{broken'), defaults);
  assert.deepEqual(readNotesSettings('null'), defaults);
  assert.equal(readNotesSettings('{"textSize":900,"format":"exe"}').textSize, 40);
  assert.equal(readNotesSettings('{"format":"markdown","citations":true}').format, 'markdown');
});
test('PDF citations use exact highlighted offsets and the nearest Eyeliner text position', async () => {
  const pdf = { numPages: 2, getPage: async () => ({
    getTextContent: async () => ({ items: [
      {str:'Top text', transform:[1,0,0,1,0,90]}, {str:'Lower text', transform:[1,0,0,1,0,20]},
    ] }),
    getViewport: () => ({ height:100, convertToViewportPoint:(x,y) => [x,100-y] }),
  }) };
  const result = await noteCitations(pdf, [{...a, yPercent:0.8}, b], 100);
  assert.equal(result.a, 'Lower text');
  assert.equal(result.b, 'Top t');
});
test('scanned pages and highlight anchors beyond available PDF text produce no invented quote', async () => {
  const pdf = {numPages:2, getPage:async () => ({getTextContent:async () => ({items:[]}), getViewport:() => ({height:100})})};
  const result = await noteCitations(pdf, [a, b], 100);
  assert.equal(result.a, '');
  assert.equal(result.b, undefined);
});
