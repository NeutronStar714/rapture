/**
 * The note editor relies on CSS `field-sizing: content` to grow with its text. WebKit before
 * Safari 26 (the engine behind Tauri on macOS 15 and earlier) ignores that property, so a
 * multiline note was clipped to one row there. These helpers provide the same behaviour by hand
 * on engines that need it, and do nothing where the CSS property works.
 */

type CssSupports = { supports(property: string, value: string): boolean };

/** True when the engine lacks `field-sizing`. Unknown engines get the manual path, which works everywhere. */
export function needsManualAutosize(
  css: CssSupports | undefined = typeof CSS !== 'undefined' ? (CSS as CssSupports) : undefined,
): boolean {
  if (!css || typeof css.supports !== 'function') return true;
  try {
    return !css.supports('field-sizing', 'content');
  } catch {
    return true;
  }
}

type ResizableTextarea = { scrollHeight: number; style: { height: string } };

/** Fit the textarea to its content. Collapsing to `auto` first lets it shrink when text is deleted. */
export function autosizeTextarea(el: ResizableTextarea | null | undefined): void {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
}
