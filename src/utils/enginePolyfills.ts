/**
 * Shims for JavaScript features that PDF.js 6 relies on but that older WebKit lacks. The
 * WKWebView that Tauri uses on macOS 15 and earlier is the known case; Chromium, WebView2 and
 * newer WebKit already have all of these, and every shim leaves an existing implementation
 * untouched. This module is loaded first on the page and first inside the PDF.js worker
 * (see pdfWorker.ts), because the worker has its own separate global scope.
 */

function define(target: object, name: string | symbol, value: unknown) {
  Object.defineProperty(target, name, { value, writable: true, configurable: true, enumerable: false });
}

/* ── ReadableStream async iteration: `for await (const chunk of stream)` ── */

type ReaderLike = { read(): Promise<{ done: boolean; value: unknown }>; releaseLock(): void };
type StreamLike = { getReader(): ReaderLike };

/** Returns true when the shim was installed, false when the engine already had support. */
export function installReadableStreamAsyncIteration(proto: object): boolean {
  const target = proto as { [Symbol.asyncIterator]?: unknown; values?: unknown };
  if (typeof target[Symbol.asyncIterator] === 'function') return false;

  async function* iterate(this: StreamLike) {
    const reader = this.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) return;
        yield value;
      }
    } finally {
      reader.releaseLock();
    }
  }

  define(target, Symbol.asyncIterator, iterate);
  if (typeof target.values !== 'function') define(target, 'values', iterate);
  return true;
}

/* ── Map / WeakMap upsert helpers: getOrInsert, getOrInsertComputed ── */

type MapLike = { has(key: unknown): boolean; get(key: unknown): unknown; set(key: unknown, value: unknown): unknown };

/** Returns true when at least one helper was installed, false when both already existed. */
export function installMapUpsert(proto: object): boolean {
  const target = proto as { getOrInsert?: unknown; getOrInsertComputed?: unknown };
  const hasGetOrInsert = typeof target.getOrInsert === 'function';
  const hasGetOrInsertComputed = typeof target.getOrInsertComputed === 'function';
  if (hasGetOrInsert && hasGetOrInsertComputed) return false;

  if (!hasGetOrInsert) {
    define(target, 'getOrInsert', function (this: MapLike, key: unknown, value: unknown) {
      if (this.has(key)) return this.get(key);
      this.set(key, value);
      return value;
    });
  }
  if (!hasGetOrInsertComputed) {
    define(target, 'getOrInsertComputed', function (this: MapLike, key: unknown, compute: (key: unknown) => unknown) {
      if (this.has(key)) return this.get(key);
      const value = compute(key);
      this.set(key, value);
      return value;
    });
  }
  return true;
}

/* ── Math.sumPrecise ── */

/**
 * Neumaier compensated summation. Exact for the integer byte counts PDF.js totals with it,
 * and far closer to the true sum than naive addition for fractional input.
 * Returns true when the shim was installed, false when the engine already had support.
 */
export function installMathSumPrecise(target: object): boolean {
  const math = target as { sumPrecise?: unknown };
  if (typeof math.sumPrecise === 'function') return false;

  define(math, 'sumPrecise', function (values: Iterable<number>) {
    let sum = 0;
    let compensation = 0;
    let count = 0;
    for (const value of values) {
      if (typeof value !== 'number') throw new TypeError('Math.sumPrecise expects an iterable of numbers');
      count++;
      const total = sum + value;
      compensation += Math.abs(sum) >= Math.abs(value) ? (sum - total) + value : (value - total) + sum;
      sum = total;
    }
    return count === 0 ? -0 : sum + compensation;
  });
  return true;
}

/* ── Apply to this global scope (page or worker) ── */

if (typeof ReadableStream !== 'undefined') installReadableStreamAsyncIteration(ReadableStream.prototype);
installMapUpsert(Map.prototype);
installMapUpsert(WeakMap.prototype);
installMathSumPrecise(Math);
