/**
 * Deterministic names for `.rapture` sidecar files.
 *
 * The old sanitiser replaced every character outside `[A-Za-z0-9 .()_-]` with `_`, which mangled
 * non-ASCII names (`有机化学.pdf` -> `______.pdf`) and let unrelated documents collide on one
 * sidecar. This module keeps Unicode readable and appends a short hash of the *original* name so
 * names that used to collapse together stay apart.
 *
 * The hash is derived, never stored: it exists only as a suffix of the file name and is recomputed
 * from `fileName` on every use. There is no index, manifest, or extra JSON field.
 *
 * `src-tauri/src/lib.rs` mirrors these rules exactly; `tests/sidecarName.test.mjs` and the Rust
 * unit tests pin the same shared vectors so the two implementations cannot drift.
 */

const SIDECAR_SUFFIX = '.rapture';

/** Conservative cap: leaves room under the 255-byte limit every target filesystem enforces. */
const MAX_SIDECAR_BYTES = 200;

const HASH_LEN = 8;

/** Characters the pre-fix sanitiser kept verbatim. */
const isLegacySafeChar = (c: string) => /^[A-Za-z0-9 .()_-]$/.test(c);

/** Characters Windows forbids in a name, plus path separators. */
const isUnsafeChar = (c: string) =>
  /^[/\\:*?"<>|]$/.test(c) || c.charCodeAt(0) < 0x20 || c.charCodeAt(0) === 0x7f;

/**
 * The stem the old sanitiser produced (ASCII whitelist, truncated to 200 characters). Used only to
 * locate sidecars written before this fix so they can be adopted under the new name.
 */
export function legacySidecarStem(name: string): string {
  return Array.from(name)
    .map(c => (isLegacySafeChar(c) ? c : '_'))
    .slice(0, 200)
    .join('');
}

/** FNV-1a 32-bit over UTF-8 bytes, as eight lowercase hex digits. Mirrored in Rust. */
export function fnv1a32Hex(bytes: Uint8Array): string {
  let hash = 0x811c9dc5;
  for (const byte of bytes) {
    hash = (hash ^ byte) >>> 0;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/** Truncates on a character boundary so the result never exceeds `maxBytes` in UTF-8. */
function truncateUtf8(value: string, maxBytes: number): string {
  const encoder = new TextEncoder();
  let out = '';
  let bytes = 0;
  for (const c of value) {
    const len = encoder.encode(c).length;
    if (bytes + len > maxBytes) break;
    out += c;
    bytes += len;
  }
  return out;
}

/**
 * File name (with extension) for a document's `.rapture` sidecar.
 *
 * A name the old rule reproduced losslessly keeps its exact previous sidecar name, so every
 * existing ASCII sidecar continues to resolve. Anything else gets readable Unicode plus
 * `-<hash>`.
 */
export function sidecarFileName(fileName: string): string {
  const chars = Array.from(fileName);

  if (chars.length > 0 && chars.every(isLegacySafeChar)) {
    return legacySidecarStem(fileName) + SIDECAR_SUFFIX;
  }

  const readable = chars
    .map(c => (isUnsafeChar(c) ? '_' : c))
    .join('')
    .trim()
    .replace(/^\.+/, '');

  const base = readable || 'document';
  const budget = MAX_SIDECAR_BYTES - (1 + HASH_LEN + SIDECAR_SUFFIX.length);
  return `${truncateUtf8(base, budget)}-${fnv1a32Hex(new TextEncoder().encode(fileName))}${SIDECAR_SUFFIX}`;
}
