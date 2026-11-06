export function flashRed(element: HTMLElement, delay = 0): Animation {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clear = 'inset 0 0 0 999px rgba(170, 38, 44, 0)';
  const red = 'inset 0 0 0 999px rgba(170, 38, 44, 0.28)';
  return element.animate(
    reducedMotion ? [{ boxShadow: red }, { boxShadow: red, offset: 0.9 }, { boxShadow: clear }]
      : [{ boxShadow: clear }, { boxShadow: red, offset: 0.4 }, { boxShadow: clear }],
    { duration: reducedMotion ? 1600 : 700, iterations: reducedMotion ? 1 : 2, delay: reducedMotion ? 0 : delay },
  );
}
