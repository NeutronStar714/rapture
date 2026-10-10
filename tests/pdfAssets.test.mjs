import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PDFJS_ASSET_BASE, PDFJS_ASSET_DIRS, PDFJS_ASSET_OPTIONS } from '../src/utils/pdfAssets.ts';

test('pdf assets: load options point every PDF.js asset kind at a copied folder', () => {
  assert.deepEqual(PDFJS_ASSET_DIRS, ['cmaps', 'standard_fonts', 'wasm', 'iccs']);
  assert.equal(PDFJS_ASSET_OPTIONS.cMapUrl, `${PDFJS_ASSET_BASE}cmaps/`);
  assert.equal(PDFJS_ASSET_OPTIONS.standardFontDataUrl, `${PDFJS_ASSET_BASE}standard_fonts/`);
  assert.equal(PDFJS_ASSET_OPTIONS.wasmUrl, `${PDFJS_ASSET_BASE}wasm/`);
  assert.equal(PDFJS_ASSET_OPTIONS.iccUrl, `${PDFJS_ASSET_BASE}iccs/`);
  assert.equal(PDFJS_ASSET_OPTIONS.cMapPacked, true);
});

test('pdf assets: the base is an absolute folder URL so it resolves from any page', () => {
  assert.match(PDFJS_ASSET_BASE, /^\/[a-z]+\/$/);
});
