import { test } from 'node:test';
import assert from 'node:assert/strict';
import { autosizeTextarea, needsManualAutosize } from '../src/utils/textareaAutosize.ts';

// A stand-in textarea: records every height assignment and reports a fixed content height.
function fakeTextarea(contentHeight) {
  const el = { scrollHeight: 0, heights: [], style: {} };
  let height = '';
  Object.defineProperty(el.style, 'height', {
    get: () => height,
    set: (value) => { height = value; el.heights.push(value); el.scrollHeight = contentHeight; },
  });
  return el;
}

test('autosize: sets the height to the content height', () => {
  const el = fakeTextarea(72);
  autosizeTextarea(el);
  assert.equal(el.style.height, '72px');
});

test('autosize: collapses to auto before measuring so a shortened note shrinks', () => {
  const el = fakeTextarea(36);
  el.style.height = '120px';
  el.heights.length = 0;
  autosizeTextarea(el);
  assert.deepEqual(el.heights, ['auto', '36px']);
});

test('autosize: ignores a missing element', () => {
  assert.doesNotThrow(() => autosizeTextarea(null));
});

test('needsManualAutosize: only when the engine lacks field-sizing, defaulting to yes when unknown', () => {
  assert.equal(needsManualAutosize({ supports: () => false }), true);
  assert.equal(needsManualAutosize({ supports: () => true }), false);
  assert.equal(needsManualAutosize(undefined), true);
});
