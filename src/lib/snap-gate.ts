export function snapStops(els: Iterable<HTMLElement>, view: { h: number; scrollY: number; pad: number; max: number }): number[] {
  const out = new Set<number>();
  for (const el of els) {
    if (!el.getClientRects().length) continue;
    const cs = getComputedStyle(el);
    const align = cs.scrollSnapAlign.split(' ').pop();
    if (!align || align === 'none') continue;
    const r = el.getBoundingClientRect();
    const top = r.top + view.scrollY;
    const margin = parseFloat(cs.scrollMarginTop) || 0;
    const y = align === 'end' ? top + r.height - view.h
      : align === 'center' ? top + r.height / 2 - (view.pad + (view.h - view.pad) / 2)
        : top - margin - view.pad;
    out.add(Math.round(Math.min(view.max, Math.max(0, y))));
  }
  return [...out].sort((a, b) => a - b);
}

export function nextStop(stops: number[], y: number, dir: number): number | undefined {
  return dir > 0 ? stops.find((s) => s > y + 4) : [...stops].reverse().find((s) => s < y - 4);
}

export function snapGate(selector: string, active: () => boolean): void {
  const root = document.documentElement;
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  let lockUntil = 0;
  const stops = () => snapStops(document.querySelectorAll<HTMLElement>(selector), {
    h: innerHeight, scrollY, pad: parseFloat(getComputedStyle(root).scrollPaddingTop) || 0, max: root.scrollHeight - innerHeight,
  });
  addEventListener('wheel', (e) => {
    if (!active() || e.ctrlKey || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
    const now = performance.now();
    if (now < lockUntil) { e.preventDefault(); lockUntil = Math.max(lockUntil, now + 240); return; }
    const dir = Math.sign(e.deltaY);
    const to = nextStop(stops(), scrollY, dir);
    if (to === undefined) return;
    const gap = Math.abs(to - scrollY);
    const delta = Math.abs(e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * innerHeight : e.deltaY);
    if (gap > innerHeight * 1.05 && delta < gap) return;
    e.preventDefault();
    lockUntil = now + (still.matches ? 300 : 750);
    scrollTo({ top: to, behavior: still.matches ? 'auto' : 'smooth' });
  }, { passive: false });
}
