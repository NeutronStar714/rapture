import { invoke } from '@tauri-apps/api/core';
import type { EyelinerNote } from '../types';

export function isTauri(): boolean {
  const w = window as any;
  return !!(w.__TAURI_INTERNALS__ || w.__TAURI__);
}

let _invoke: typeof invoke | null | undefined;

function getInvoke(): typeof invoke | null {
  if (_invoke !== undefined) return _invoke;
  if (!isTauri()) { _invoke = null; return null; }
  _invoke = invoke;
  return _invoke;
}

/** Save notes → Rust writes to %APPDATA%\Rapture\Notes\{name}.rapture */
export async function tauriSaveNotes(
  fileName: string,
  notes: EyelinerNote[],
): Promise<string | null> {
  const inv = getInvoke();
  if (!inv) return null;
  return inv('save_notes', { fileName, notes });
}

/** Export via native save dialog → user picks where to save.
 *  Returns `undefined` when not in Tauri (fall back to browser download).
 *  Returns `null` when user cancelled the dialog (no fallback).
 */
export async function tauriExportDialog(
  fileName: string,
  notes: EyelinerNote[],
): Promise<string | null | undefined> {
  const inv = getInvoke();
  if (!inv) return undefined; // not in Tauri
  return inv('export_notes_dialog', { fileName, notes });
}
