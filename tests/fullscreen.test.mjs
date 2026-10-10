import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toggleFullscreen } from '../src/utils/fullscreen.ts';

// Stand-ins for the two places fullscreen can be driven from.
function nativeWindow(initial) {
  const w = { state: initial, calls: [] };
  w.api = { isFullscreen: async () => w.state, setFullscreen: async (on) => { w.calls.push(on); w.state = on; } };
  return w;
}
function webDocument(initial) {
  const d = { element: initial ? {} : null, calls: [] };
  d.api = {
    get fullscreenElement() { return d.element; },
    requestFullscreen: async () => { d.calls.push('request'); d.element = {}; },
    exitFullscreen: async () => { d.calls.push('exit'); d.element = null; },
  };
  return d;
}

test('inside the desktop app, toggling uses the native window and leaves the web API alone', async () => {
  const native = nativeWindow(false);
  const web = webDocument(false);
  assert.equal(await toggleFullscreen({ native: native.api, web: web.api }), true);
  assert.equal(await toggleFullscreen({ native: native.api, web: web.api }), false);
  assert.deepEqual(native.calls, [true, false]);
  assert.deepEqual(web.calls, []);
});

test('in a browser, toggling uses the web Fullscreen API', async () => {
  const web = webDocument(false);
  assert.equal(await toggleFullscreen({ web: web.api }), true);
  assert.equal(await toggleFullscreen({ web: web.api }), false);
  assert.deepEqual(web.calls, ['request', 'exit']);
});

test('the native window state is read fresh, so leaving fullscreen with Escape is respected', async () => {
  const native = nativeWindow(true); // the OS already put the window in fullscreen
  const web = webDocument(false);
  assert.equal(await toggleFullscreen({ native: native.api, web: web.api }), false);
  assert.deepEqual(native.calls, [false]);
});

test('a native failure is reported to the caller rather than swallowed', async () => {
  const native = { isFullscreen: async () => false, setFullscreen: async () => { throw new Error('window gone'); } };
  await assert.rejects(toggleFullscreen({ native, web: webDocument(false).api }), /window gone/);
});
