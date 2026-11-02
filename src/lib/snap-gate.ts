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
  const desk = matchMedia('(hover: hover) and (pointer: fine)');
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
  };
  const land = () => {
    if (desk.matches || !active() || !free || gliding || touching) return;
    const from = base;
    base = scrollY;
    if (scrollY - from <= 4) return;
    const list = stops();
    if (past(list)) return;
    const to = list.find((y) => y > from + 2);
    if (to === undefined || Math.abs(to - scrollY) > innerHeight * 1.05) return;
    if (Math.abs(to - scrollY) <= 1 || still.matches) { scrollTo(0, to); base = scrollY; loose(false); return; }
    glide(to, () => loose(false));
  };
  const rest = () => {
    if (!free || gliding || !active()) return;
    const list = stops();
    if (!past(list) && list.some((y) => Math.abs(y - scrollY) <= 2)) loose(false);
  };
  const nav = performance.getEntriesByType?.('navigation')[0] as PerformanceNavigationTiming | undefined;
  if (active() && nav && (nav.type === 'reload' || nav.type === 'back_forward')) loose(true);
  addEventListener('scroll', () => {
    if (gliding || desk.matches) return;
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
    if (desk.matches || !active() || e.altKey || e.ctrlKey || e.metaKey) return;
    const up = e.key === 'ArrowUp' || e.key === 'PageUp' || e.key === 'Home' || e.key === 'End' || (e.key === ' ' && e.shiftKey);
    const down = e.key === 'ArrowDown' || e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey);
    if (up || (down && past(stops()))) loose(true);
    else if (down) rest();
  });

  let target = scrollY;
  let running = false;
  let lastWheel = 0;
  let dir = 0;
  let nudge = 0;
  let prev = 0;
  let set = -1;
  const run = (now: number) => {
    const y = scrollY;
    if (set >= 0 && Math.abs(y - set) > 3) { running = false; target = y; return; }
    const d = target - y;
    if (Math.abs(d) < 1) { scrollTo({ top: target, behavior: 'instant' }); running = false; return; }
    const k = 1 - 0.86 ** (Math.min(64, now - prev) / 16.67);
    prev = now;
    const move = d * k;
    set = y + (Math.abs(move) < 1 ? Math.sign(d) : move);
    scrollTo({ top: set, behavior: 'instant' });
    requestAnimationFrame(run);
  };
  const go = (to: number) => {
    target = Math.max(0, Math.min(root.scrollHeight - innerHeight, to));
    if (!running) { running = true; set = -1; prev = performance.now(); requestAnimationFrame(run); }
  };
  const inner = (el: EventTarget | null, dy: number) => {
    for (let n = el instanceof Element ? el : null; n && n !== document.body && n !== root; n = n.parentElement) {
      const oy = getComputedStyle(n).overflowY;
      if ((oy === 'auto' || oy === 'scroll') && n.scrollHeight > n.clientHeight + 1) {
        if (dy > 0 ? n.scrollTop + n.clientHeight < n.scrollHeight - 1 : n.scrollTop > 0) return true;
      }
    }
    return false;
  };
  const rest2 = () => {
    if (!active() || dir <= 0 || performance.now() - lastWheel < 170) return;
    const list = stops();
    if (!list.length) return;
    const y = target;
    const h = innerHeight;
    const near = list.filter((s) => s >= y - h * 0.06 && s <= y + h * 0.3 && s <= list[list.length - 1]);
    if (!near.length) return;
    const to = near.reduce((a, b) => (Math.abs(b - y) < Math.abs(a - y) ? b : a));
    if (Math.abs(to - y) > 1) go(to);
  };
  addEventListener('scroll', () => { if (desk.matches && !running) target = scrollY; }, { passive: true });
  addEventListener('wheel', (e) => {
    if (!active() || e.ctrlKey || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
    if (!desk.matches) {
      if (e.deltaY < 0 || past(stops())) loose(true);
      return;
    }
    if (still.matches || inner(e.target, e.deltaY)) return;
    e.preventDefault();
    const raw = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaMode === 2 ? e.deltaY * innerHeight : e.deltaY;
    const step = Math.sign(raw) * Math.min(Math.abs(raw) * 0.8, 150);
    if (!running) target = scrollY;
    dir = Math.sign(raw);
    lastWheel = performance.now();
    go(target + step);
    clearTimeout(nudge);
    nudge = window.setTimeout(rest2, 180);
  }, { passive: false });
}
