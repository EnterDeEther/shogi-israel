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

export const glideTime = (dist: number): number => Math.round(Math.min(950, Math.max(520, 380 + dist * 0.6)));

const ease = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

export function snapGate(selector: string, active: () => boolean): void {
  const root = document.documentElement;
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  let lockUntil = 0;
  let gliding = false;
  let free = false;
  let touching = false;
  let fy = 0;
  let pull = 0;
  let end = Infinity;
  let base = scrollY;
  let settle = 0;
  const stops = () => snapStops(document.querySelectorAll<HTMLElement>(selector), {
    h: innerHeight, scrollY, pad: parseFloat(getComputedStyle(root).scrollPaddingTop) || 0, max: root.scrollHeight - innerHeight,
  });
  const loose = (on: boolean) => {
    if (free === on) return;
    free = on;
    root.toggleAttribute('data-snap-free', on);
  };
  const past = (list: number[]) => !list.length || scrollY >= list[list.length - 1] - 4;
  const glide = (to: number, done: () => void) => {
    const from = scrollY;
    const dur = glideTime(Math.abs(to - from));
    const t0 = performance.now();
    gliding = true;
    root.style.scrollSnapType = 'none';
    root.style.scrollBehavior = 'auto';
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / dur);
      scrollTo(0, from + (to - from) * ease(k));
      if (k < 1) { requestAnimationFrame(tick); return; }
      done();
      root.style.scrollSnapType = '';
      root.style.scrollBehavior = '';
      gliding = false;
      base = scrollY;
    };
    requestAnimationFrame(tick);
    return dur;
  };
  const land = () => {
    if (!active() || !free || gliding || touching) return;
    const from = base;
    base = scrollY;
    if (scrollY - from <= 4) return;
    const list = stops();
    if (past(list)) return;
    const to = list.find((y) => y > from + 2);
    if (to === undefined || Math.abs(to - scrollY) > innerHeight * 1.05) return;
    if (Math.abs(to - scrollY) <= 1 || still.matches) { scrollTo(0, to); base = scrollY; loose(false); return; }
    lockUntil = performance.now() + glide(to, () => loose(false)) + 240;
  };
  const rest = () => {
    if (!free || gliding || !active()) return;
    const list = stops();
    if (!past(list) && list.some((y) => Math.abs(y - scrollY) <= 2)) loose(false);
  };
  const nav = performance.getEntriesByType?.('navigation')[0] as PerformanceNavigationTiming | undefined;
  if (active() && nav && (nav.type === 'reload' || nav.type === 'back_forward')) loose(true);
  addEventListener('scroll', () => {
    if (gliding) return;
    clearTimeout(settle);
    settle = window.setTimeout(() => { if (free) land(); else base = scrollY; }, 140);
  }, { passive: true });
  addEventListener('touchstart', (e) => {
    touching = true;
    fy = e.touches[0]?.clientY ?? 0;
    pull = 0;
    rest();
    end = active() ? (stops().pop() ?? -Infinity) : Infinity;
  }, { passive: true });
  addEventListener('touchmove', (e) => {
    if (!active() || gliding) return;
    const y = e.touches[0]?.clientY ?? fy;
    pull += y - fy;
    fy = y;
    if (pull > 6 || (pull < -6 && scrollY >= end - 4)) loose(true);
  }, { passive: true });
  const lift = () => {
    touching = false;
    clearTimeout(settle);
    settle = window.setTimeout(() => { if (free) land(); else base = scrollY; }, 160);
  };
  addEventListener('touchend', lift, { passive: true });
  addEventListener('touchcancel', lift, { passive: true });
  addEventListener('keydown', (e) => {
    if (!active() || e.altKey || e.ctrlKey || e.metaKey) return;
    const up = e.key === 'ArrowUp' || e.key === 'PageUp' || e.key === 'Home' || e.key === 'End' || (e.key === ' ' && e.shiftKey);
    const down = e.key === 'ArrowDown' || e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey);
    if (up || (down && past(stops()))) loose(true);
    else if (down) rest();
  });
  addEventListener('wheel', (e) => {
    if (!active() || e.ctrlKey || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
    const now = performance.now();
    if (gliding || now < lockUntil) { e.preventDefault(); lockUntil = Math.max(lockUntil, now + 240); return; }
    const list = stops();
    if (e.deltaY < 0 || past(list)) { loose(true); return; }
    const to = nextStop(list, scrollY, 1);
    if (to === undefined) { loose(true); return; }
    const gap = to - scrollY;
    const delta = Math.abs(e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * innerHeight : e.deltaY);
    if (gap > innerHeight * 1.05 && delta < gap) return;
    e.preventDefault();
    if (still.matches) { scrollTo(0, to); base = scrollY; loose(false); lockUntil = now + 300; return; }
    lockUntil = now + glide(to, () => loose(false)) + 240;
  }, { passive: false });
}
