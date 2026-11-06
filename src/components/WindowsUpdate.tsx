import React, { useEffect, useRef, useState } from 'react';
import { Download, ExternalLink } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { isTauri } from '../utils/tauri';

interface UpdateInfo {
  version: string;
  tag: string;
}

export default function WindowsUpdate({ beforeInstall }: { beforeInstall: () => Promise<void> }) {
  const windowsDesktop = isTauri() && /\bWindows\b/.test(navigator.userAgent);
  const canInstall = import.meta.env.PROD;
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [open, setOpen] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!windowsDesktop) return;
    let active = true;
    invoke<UpdateInfo | null>('check_windows_update').then(result => {
      if (active) setUpdate(result);
    }).catch(error => console.debug('Rapture update check unavailable', error));
    return () => { active = false; };
  }, [windowsDesktop]);

  useEffect(() => {
    if (open) dialog.current?.showModal();
  }, [open]);

  if (!update) return null;

  const viewRelease = async () => {
    setError('');
    try {
      await invoke('open_rapture_releases', { tag: update.tag });
    } catch (error) {
      setError(String(error));
    }
  };

  const install = async () => {
    setError('');
    setInstalling(true);
    setStatus('Downloading and checking the installer…');
    try {
      await beforeInstall();
      await invoke('install_windows_update', { version: update.version });
    } catch (error) {
      setStatus('');
      setError(String(error));
      setInstalling(false);
      return;
    }
    setStatus('Windows Installer is open. Rapture is closing for the update.');
    try {
      await getCurrentWindow().close();
    } catch {
      setStatus('Windows Installer is open. Close Rapture to finish the update.');
    }
  };

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => { setError(''); setStatus(''); setOpen(true); }}
        className="min-[880px]:absolute min-[880px]:left-full min-[880px]:top-1/2 min-[880px]:-translate-y-1/2 min-[880px]:ml-3 inline-flex items-center gap-2 whitespace-nowrap rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm font-semibold text-[#AA262C] shadow-xs hover:bg-red-50 cursor-pointer"
      >
        <Download size={15} aria-hidden="true" />
        New Version
      </button>
      {open && (
        <dialog
          ref={dialog}
          onClose={() => setOpen(false)}
          onCancel={event => { if (installing) event.preventDefault(); }}
          aria-labelledby="windows-update-title"
          className="m-auto w-96 max-w-[calc(100vw-2rem)] rounded-xl border border-gray-200 bg-white p-5 text-left text-slate-800 shadow-xl backdrop:bg-black/40"
        >
          <h2 id="windows-update-title" className="text-lg font-semibold">Rapture {update.version}</h2>
          <p className="mt-2 text-sm text-slate-600">
            {canInstall ? 'A new Windows version is available. Rapture will close when Windows Installer opens.' : 'A new Windows version is available. Install it from the packaged Windows app.'}
          </p>
          {status && <p role="status" className="mt-3 text-sm text-slate-600">{status}</p>}
          {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
          <div className="mt-5 flex flex-wrap items-center justify-end gap-2 text-sm">
            <button type="button" onClick={viewRelease} className="mr-auto flex items-center gap-1 rounded px-2 py-1.5 text-[#AA262C] hover:bg-red-50 cursor-pointer">
              Release notes <ExternalLink size={13} aria-hidden="true" />
            </button>
            <button type="button" autoFocus disabled={installing} onClick={() => dialog.current?.close()}
              className="rounded-md px-2 py-1.5 hover:bg-slate-100 cursor-pointer disabled:opacity-50">Close</button>
            <button type="button" disabled={!canInstall || installing} onClick={install}
              className="rounded-md bg-[#AA262C] px-3 py-1.5 font-semibold text-white hover:bg-[#8F1F24] cursor-pointer disabled:opacity-50">Install</button>
          </div>
        </dialog>
      )}
    </>
  );
}
