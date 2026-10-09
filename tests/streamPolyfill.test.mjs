import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installReadableStreamAsyncIteration } from '../src/utils/streamPolyfill.ts';

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

test('adds async iteration that yields every chunk in order', async () => {
  assert.equal(installReadableStreamAsyncIteration(LegacyStream.prototype), true);
  const seen = [];
  for await (const chunk of new LegacyStream(['a', 'b', 'c'])) seen.push(chunk);
  assert.deepEqual(seen, ['a', 'b', 'c']);
});

test('releases the reader lock after the stream ends', async () => {
  installReadableStreamAsyncIteration(LegacyStream.prototype);
  const stream = new LegacyStream(['only']);
  for await (const _ of stream) { /* drain */ }
  assert.equal(stream.released, true);
});

test('leaves an engine that already supports async iteration untouched', () => {
  const native = ReadableStream.prototype[Symbol.asyncIterator];
  assert.equal(typeof native, 'function', 'Node is expected to support this natively');
  assert.equal(installReadableStreamAsyncIteration(ReadableStream.prototype), false);
  assert.equal(ReadableStream.prototype[Symbol.asyncIterator], native);
});
