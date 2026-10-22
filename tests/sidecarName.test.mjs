import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  sidecarFileName,
  legacySidecarStem,
  fnv1a32Hex,
} from '../src/utils/sidecarName.ts';

const utf8 = (s) => new TextEncoder().encode(s);

test('FNV-1a-32 matches the reference vectors (shared with the Rust implementation)', () => {
  // Canonical FNV test vectors; lib.rs asserts the same three.
  assert.equal(fnv1a32Hex(utf8('')), '811c9dc5');
  assert.equal(fnv1a32Hex(utf8('a')), 'e40c292c');
  assert.equal(fnv1a32Hex(utf8('foobar')), 'bf9cf968');
});

test('names the old rule reproduced losslessly keep their exact previous sidecar', () => {
  for (const name of [
    'Organic_Chemistry_J_Clayden.pdf',
    'Notes (draft) v2.pdf',
    'a-b_c.1.pdf',
  ]) {
    assert.equal(sidecarFileName(name), `${name}.rapture`);
    assert.equal(sidecarFileName(name), legacySidecarStem(name) + '.rapture');
  }
});

test('non-ASCII names stay readable and gain a hash instead of collapsing to underscores', () => {
  const out = sidecarFileName('有机化学.pdf');
  assert.ok(out.startsWith('有机化学.pdf-'), out);
  assert.match(out, /-[0-9a-f]{8}\.rapture$/);
  assert.notEqual(out, '______.pdf.rapture');
});

test('distinct names that used to collide now get distinct sidecars', () => {
  const a = sidecarFileName('有机化学.pdf');
  const b = sidecarFileName('物理化学.pdf');
  assert.notEqual(a, b);
  // Both would have become "______.pdf" under the old rule.
  assert.equal(legacySidecarStem('有机化学.pdf'), legacySidecarStem('物理化学.pdf'));

  // Same readable form, different originals: the hash separates them.
  const q = sidecarFileName('a?b.pdf');
  const s = sidecarFileName('a*b.pdf');
  assert.equal(q.replace(/-[0-9a-f]{8}/, ''), s.replace(/-[0-9a-f]{8}/, ''));
  assert.notEqual(q, s);
});

test('path separators and Windows-reserved characters become underscores', () => {
  const out = sidecarFileName('a/b\\c:d*e?f"g<h>i|j.pdf');
  assert.ok(out.startsWith('a_b_c_d_e_f_g_h_i_j.pdf-'), out);
  assert.ok(!/[/\\:*?"<>|]/.test(out.slice(0, out.lastIndexOf('-'))));
});

test('long Unicode names are cut on a character boundary within the byte budget', () => {
  const out = sidecarFileName('有'.repeat(300) + '.pdf');
  const bytes = utf8(out).length;
  assert.ok(bytes <= 200, `sidecar name is ${bytes} bytes`);
  assert.match(out, /-[0-9a-f]{8}\.rapture$/);
  // No replacement characters or truncated code points survived the cut.
  assert.ok(!out.includes('\uFFFD'));
});

test('the hash is deterministic and depends only on the original name', () => {
  assert.equal(sidecarFileName('有机化学.pdf'), sidecarFileName('有机化学.pdf'));
  assert.match(sidecarFileName('有机化学.pdf'), /-[0-9a-f]{8}\.rapture$/);
});

test('degenerate names still yield a usable file name', () => {
  assert.match(sidecarFileName(''), /^document-[0-9a-f]{8}\.rapture$/);
  assert.match(sidecarFileName('???'), /^___-[0-9a-f]{8}\.rapture$/);
  // New-branch names lose leading dots, so the sidecar is never a hidden file.
  assert.equal(sidecarFileName('..有机.pdf').startsWith('.'), false);
  // Legacy-safe names pass through untouched, exactly as before the fix.
  assert.equal(sidecarFileName('..pdf'), '..pdf.rapture');
});
