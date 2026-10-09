/**
 * Presentation mode. Inside the desktop app the window itself goes fullscreen through Tauri,
 * which works on every platform and does exactly what the View menu's fullscreen item does. In a
 * plain browser the page uses the web Fullscreen API instead. The web API is not offered by the
 * macOS web view without a private Apple setting, so the desktop app must never depend on it.
 */

export type NativeFullscreen = { isFullscreen(): Promise<boolean>; setFullscreen(on: boolean): Promise<void> };
export type WebFullscreen = {
  readonly fullscreenElement: unknown;
  requestFullscreen(): Promise<void>;
  exitFullscreen(): Promise<void>;
};
export type FullscreenHost = { native?: NativeFullscreen; web: WebFullscreen };

/** Toggles presentation mode and resolves to the new state (true = fullscreen). */
export async function toggleFullscreen({ native, web }: FullscreenHost): Promise<boolean> {
  if (native) {
    // Read the live state: the OS may have entered or left fullscreen on its own.
    const next = !(await native.isFullscreen());
    await native.setFullscreen(next);
    return next;
  }
  if (web.fullscreenElement) {
    await web.exitFullscreen();
    return false;
  }
  await web.requestFullscreen();
  return true;
}
