import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchPdfText } from '../src/utils/pdfSearch.ts';

const markedText = result => result.snippet.slice(result.snippetMatchStart, result.snippetMatchEnd);

test('normal Chinese queries find radical forms and text split across PDF runs', () => {
  const text = '她不能先⾃ 贬 ⾝ 价，否则他更有了藉 ⼝，拒绝和她结婚。';
  const [phrase] = searchPdfText({ 176: text }, '自贬身价');
  assert.equal(phrase.pageNumber, 176);
  assert.equal(phrase.index, text.indexOf('⾃'));
  assert.equal(markedText(phrase), '⾃ 贬 ⾝ 价');
  assert.deepEqual(searchPdfText({ 176: text }, '借口'), []);
  assert.equal(markedText(searchPdfText({ 176: text }, '藉口')[0]), '藉 ⼝');
});

test('the same equivalence works with radical queries and ordinary Chinese text', () => {
  const results = searchPdfText({ 1: '自身与口' }, ' ⾃　⾝ ');
  assert.equal(markedText(results[0]), '自身');
  assert.equal(markedText(searchPdfText({ 1: '自身与口' }, '⼝')[0]), '口');
});

test('preview ranges survive compatibility expansions and composed accents', () => {
  const text = `${'前'.repeat(60)}ﬃ cafe\u0301 神`;
  const [accent] = searchPdfText({ 1: text }, 'CAFÉ');
  assert.ok(accent.snippet.startsWith('...'));
  assert.equal(accent.index, text.indexOf('cafe'));
  assert.equal(markedText(accent), 'cafe\u0301');
  assert.equal(markedText(searchPdfText({ 1: text }, 'ffi')[0]), 'ﬃ');
  assert.equal(markedText(searchPdfText({ 1: text }, '神')[0]), '神');
});

test('Latin spaces and literal regex characters still matter', () => {
  assert.deepEqual(searchPdfText({ 1: 'a b' }, 'ab'), []);
  assert.equal(markedText(searchPdfText({ 1: 'A[1] a11' }, 'a[1]')[0]), 'A[1]');
  assert.deepEqual(searchPdfText({ 1: 'anything' }, '　'), []);
});
