/**
 * ReadableStream async iteration (`for await (const chunk of stream)`) is missing from WebKit
 * before Safari 26, including the WKWebView that Tauri uses on macOS 15 and earlier. PDF.js's
 * `getTextContent` depends on it, so without this shim every document fails to open on those
 * Macs. Engines that already support it (Chromium, WebView2, newer WebKit) are left untouched.
 */
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

  Object.defineProperty(target, Symbol.asyncIterator, { value: iterate, writable: true, configurable: true });
  if (typeof target.values !== 'function') {
    Object.defineProperty(target, 'values', { value: iterate, writable: true, configurable: true });
  }
  return true;
}

if (typeof ReadableStream !== 'undefined') {
  installReadableStreamAsyncIteration(ReadableStream.prototype);
}
