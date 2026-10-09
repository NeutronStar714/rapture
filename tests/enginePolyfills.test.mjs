import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  installMapUpsert,
  installMathSumPrecise,
  installReadableStreamAsyncIteration,
} from '../src/utils/enginePolyfills.ts';

/* ── ReadableStream async iteration ── */

// A minimal stand-in for a ReadableStream on an engine that lacks async iteration.
class LegacyStream {
  constructor(chunks) { this.chunks = [...chunks]; this.released = false; }
  getReader() {
    return {
      read: async () => this.chunks.length ? { done: false, value: this.chunks.shift() } : { done: true, value: undefined },
      releaseLock: () => { this.released = true; },
    };
  }
}

test('stream: adds async iteration that yields every chunk in order', async () => {
  assert.equal(installReadableStreamAsyncIteration(LegacyStream.prototype), true);
  const seen = [];
  for await (const chunk of new LegacyStream(['a', 'b', 'c'])) seen.push(chunk);
  assert.deepEqual(seen, ['a', 'b', 'c']);
});

test('stream: releases the reader lock after the stream ends', async () => {
  installReadableStreamAsyncIteration(LegacyStream.prototype);
  const stream = new LegacyStream(['only']);
  for await (const _ of stream) { /* drain */ }
  assert.equal(stream.released, true);
});

test('stream: leaves an engine that already supports async iteration untouched', () => {
  const native = ReadableStream.prototype[Symbol.asyncIterator];
  assert.equal(typeof native, 'function', 'Node is expected to support this natively');
  assert.equal(installReadableStreamAsyncIteration(ReadableStream.prototype), false);
  assert.equal(ReadableStream.prototype[Symbol.asyncIterator], native);
});

/* ── Map / WeakMap upsert helpers ── */

// A minimal map that deliberately does not inherit from Map.prototype.
class LegacyMap {
  constructor() { this.store = new Map(); }
  has(key) { return this.store.has(key); }
  get(key) { return this.store.get(key); }
  set(key, value) { this.store.set(key, value); return this; }
}

test('upsert: getOrInsert returns the existing value without overwriting it', () => {
  assert.equal(installMapUpsert(LegacyMap.prototype), true);
  const map = new LegacyMap().set('k', 'existing');
  assert.equal(map.getOrInsert('k', 'default'), 'existing');
  assert.equal(map.get('k'), 'existing');
});

test('upsert: getOrInsert stores and returns the default for a missing key', () => {
  installMapUpsert(LegacyMap.prototype);
  const map = new LegacyMap();
  assert.equal(map.getOrInsert('k', 'default'), 'default');
  assert.equal(map.get('k'), 'default');
});

test('upsert: getOrInsertComputed calls the callback with the key only when the key is missing', () => {
  installMapUpsert(LegacyMap.prototype);
  const map = new LegacyMap();
  const calls = [];
  const compute = key => { calls.push(key); return key + '!'; };
  assert.equal(map.getOrInsertComputed('a', compute), 'a!');
  assert.equal(map.getOrInsertComputed('a', compute), 'a!');
  assert.deepEqual(calls, ['a']);
  assert.equal(map.get('a'), 'a!');
});

test('upsert: leaves a prototype that already has both helpers untouched', () => {
  const getOrInsert = () => 'mine';
  const getOrInsertComputed = () => 'mine too';
  const proto = { getOrInsert, getOrInsertComputed };
  assert.equal(installMapUpsert(proto), false);
  assert.equal(proto.getOrInsert, getOrInsert);
  assert.equal(proto.getOrInsertComputed, getOrInsertComputed);
});

/* ── Math.sumPrecise ── */

test('sumPrecise: totals integers exactly', () => {
  const math = {};
  assert.equal(installMathSumPrecise(math), true);
  assert.equal(math.sumPrecise([1, 2, 3, 4]), 10);
});

test('sumPrecise: is not fooled by cancellation that breaks naive addition', () => {
  const math = {}; installMathSumPrecise(math);
  assert.equal(1e16 + 1 - 1e16, 0, 'naive addition loses the 1');
  assert.equal(math.sumPrecise([1e16, 1, -1e16]), 1);
  assert.equal(math.sumPrecise([0.1, 0.2, 0.3]), 0.6);
});

test('sumPrecise: accepts any iterable and returns -0 for an empty one', () => {
  const math = {}; installMathSumPrecise(math);
  assert.equal(math.sumPrecise(new Set([2, 3])), 5);
  assert.ok(Object.is(math.sumPrecise([]), -0));
});

test('sumPrecise: leaves an existing implementation untouched', () => {
  const sumPrecise = () => 42;
  const math = { sumPrecise };
  assert.equal(installMathSumPrecise(math), false);
  assert.equal(math.sumPrecise, sumPrecise);
});
