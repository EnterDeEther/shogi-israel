// The site tours on the home page: a dimmed page, a ring around one thing at a time, and a card that waits for
// "הבא" (it never moves on by itself). Steps and copy: src/lib/tour.ts. Loaded only when a visitor starts one
// (the starters and /?tour=… are wired in src/components/Footer.astro).
//
// Phones get the card as a bottom sheet, and menu steps open the ☰ panel themselves. From 1040px (where the
// header dropdowns start) the card sits under or over the highlighted item, and dropdowns stay closed.
// Tapping the highlighted item leaves the tour and does what the tap would have done; a tap on the dimmed page,
// ✕, Escape or "דלגו על הסיור" closes it.
import { TOURS, counter, readTourEnd, stepsFor, writeTourEnd, type TourEnd, type TourId, type TourStep } from '../lib/tour';

const WIDE = '(min-width: 1040px)';
const GAP = 14;

const store = (): Storage | undefined => { try { return localStorage; } catch { return undefined; } };
const visible = (el: Element) => el.getClientRects().length > 0;
const narrowMenu = () => document.querySelector<HTMLDetailsElement>('[data-nav-narrow]');
const smooth = (): ScrollBehavior => (matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');

/** The element a step points at: the one showing now, or the one inside the closed phone menu. */
function find(target: string): HTMLElement | null {
  const all = [...document.querySelectorAll<HTMLElement>(`[data-tour="${target}"]`)];
  const shown = all.find(visible);
  if (shown) return shown;
  const menu = narrowMenu();
  return menu && visible(menu) ? all.find((el) => menu.contains(el)) ?? null : null;
}

function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, text?: string): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (text !== undefined) el.textContent = text;
  return el;
}

const CLOSE_ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg>';

let running = false;

export function startTour(id: TourId, from?: HTMLElement | null): void {
  if (running) return;
  const tour = TOURS[id];
  const steps = stepsFor(tour.steps, (t) => find(t) !== null);
  if (steps.length === 0) return;
  running = true;
  const root = document.documentElement;
  const firstTime = readTourEnd(store(), id) === null;
  // -1 is the start card, steps.length the end card
  let at = -1;
  let target: HTMLElement | null = null;
  let openedMenu = false;
  let raf = 0;

  const catcher = h('div', { class: 'tour-catch', 'aria-hidden': 'true' });
  const spot = h('div', { class: 'tour-spot', 'aria-hidden': 'true' });
  const card = h('div', { class: 'tour-card', role: 'dialog', 'aria-modal': 'false', tabindex: '-1', 'aria-labelledby': 'tour-count tour-title', 'aria-describedby': 'tour-body' });
  document.body.append(catcher, spot, card);
  root.classList.add('tour-on');

  const setMenu = (open: boolean) => {
    const menu = narrowMenu();
    if (!menu) return;
    if (open && !menu.open) { window.scrollTo({ top: 0 }); menu.open = true; openedMenu = true; }
    if (!open && openedMenu) { menu.open = false; openedMenu = false; }
  };

  function bringIntoView(el: HTMLElement) {
    const panel = el.closest<HTMLElement>('.panel');
    if (panel) {
      // the panel scrolls on its own; put the item at its top so the sheet below never covers it
      panel.scrollTop += el.getBoundingClientRect().top - panel.getBoundingClientRect().top - 8;
      return;
    }
    const r = el.getBoundingClientRect();
    const wide = matchMedia(WIDE).matches;
    const bottom = wide ? innerHeight - 260 : innerHeight * 0.5;
    if (r.top < 8 || r.bottom > bottom) window.scrollTo({ top: scrollY + r.top - innerHeight * (wide ? 0.3 : 0.15), behavior: smooth() });
  }

  function place() {
    const wide = matchMedia(WIDE).matches;
    card.classList.toggle('tour-card--sheet', !wide);
    const r = target && visible(target) ? target.getBoundingClientRect() : null;
    catcher.classList.toggle('tour-catch--dim', !r);
    spot.hidden = !r;
    if (!wide) card.style.top = card.style.left = '';
    if (r) {
      // on a phone a long menu group can reach under the sheet: the ring stops above it
      const bottom = wide ? r.bottom + 4 : Math.min(r.bottom + 4, card.getBoundingClientRect().top - 8);
      Object.assign(spot.style, { top: `${r.top - 4}px`, left: `${r.left - 4}px`, width: `${r.width + 8}px`, height: `${Math.max(0, bottom - r.top + 4)}px` });
    }
    if (!wide) return;
    const w = card.offsetWidth, ch = card.offsetHeight;
    let top: number, left: number;
    if (r && r.bottom + GAP + ch <= innerHeight - 12) {
      top = r.bottom + GAP;
      left = r.right - w; // RTL: line up with the item's right edge
    } else if (r && r.top - GAP - ch >= 12) {
      top = r.top - GAP - ch;
      left = r.right - w;
    } else if (r) {
      // a tall item: beside it, on the side it reads towards first (left), else on the right
      top = Math.min(Math.max(12, r.top), innerHeight - ch - 12);
      left = r.left - GAP - w >= 12 ? r.left - GAP - w : r.right + GAP;
    } else {
      top = (innerHeight - ch) / 2;
      left = (innerWidth - w) / 2;
    }
    card.style.top = `${Math.round(top)}px`;
    card.style.left = `${Math.round(Math.min(Math.max(12, left), innerWidth - w - 12))}px`;
  }

  const loop = () => { place(); raf = requestAnimationFrame(loop); };

  function nextStepLink(): { href: string; label: string } {
    const next = [...document.querySelectorAll<HTMLAnchorElement>('a[data-tour="next"]')].find(visible);
    if (next) return { href: next.href, label: 'לצעד הבא שלי' };
    const first = [...document.querySelectorAll<HTMLAnchorElement>('a[data-tour="try"]')].find(visible);
    return { href: first?.href ?? '/try/', label: tour.end.primary };
  }

  function render() {
    card.replaceChildren();
    const head = h('div', { class: 'tour-head' });
    const step: TourStep | undefined = steps[at];
    head.append(h('p', { class: 'tour-count', id: 'tour-count' }, step ? counter(at + 1, steps.length) : at < 0 ? tour.name : 'סוף הסיור'));
    const x = h('button', { type: 'button', class: 'tour-x', 'aria-label': 'סגירת הסיור', 'data-act': 'skip' });
    x.innerHTML = CLOSE_ICON;
    head.append(x);
    card.append(head);

    const actions = h('div', { class: 'tour-actions' });
    if (at < 0) {
      card.append(h('h2', { class: 'tour-title', id: 'tour-title' }, tour.intro.title), h('p', { class: 'tour-body', id: 'tour-body' }, tour.intro.body(steps.length)));
      actions.append(h('button', { type: 'button', class: 'btn btn-ghost', 'data-act': 'skip' }, tour.intro.secondary), h('button', { type: 'button', class: 'btn', 'data-act': 'next' }, tour.intro.primary));
      card.append(actions);
    } else if (step) {
      card.append(h('h2', { class: 'tour-title', id: 'tour-title' }, step.title), h('p', { class: 'tour-body', id: 'tour-body' }, step.body));
      if (step.note) card.append(h('p', { class: 'tour-note' }, step.note));
      if (step.link) card.append(h('a', { class: 'tour-link', href: step.link.href, 'data-act': 'leave' }, step.link.label));
      const back = h('button', { type: 'button', class: 'btn btn-ghost', 'data-act': 'back' }, 'הקודם');
      if (at === 0) back.hidden = true;
      actions.append(back, h('button', { type: 'button', class: 'btn', 'data-act': 'next' }, 'הבא'));
      card.append(actions, h('button', { type: 'button', class: 'tour-skip', 'data-act': 'skip' }, 'דלגו על הסיור'));
    } else {
      const next = nextStepLink();
      card.append(h('h2', { class: 'tour-title', id: 'tour-title' }, tour.end.title), h('p', { class: 'tour-body', id: 'tour-body' }, tour.end.body));
      actions.append(h('button', { type: 'button', class: 'btn btn-ghost', 'data-act': 'done' }, tour.end.secondary), h('a', { class: 'btn', href: next.href, 'data-act': 'finish' }, next.label));
      card.append(actions);
    }
  }

  function show(i: number) {
    at = Math.max(-1, Math.min(steps.length, i));
    const step = steps[at];
    target = step ? find(step.target) : null;
    const menu = narrowMenu();
    setMenu(!!(target && menu?.contains(target)));
    if (target) bringIntoView(target);
    render();
    place();
    card.focus({ preventScroll: true });
  }

  function end(how: TourEnd, keepMenu = false) {
    if (!running) return;
    running = false;
    cancelAnimationFrame(raf);
    removeEventListener('keydown', onKey, true);
    removeEventListener('resize', onResize);
    catcher.remove(); spot.remove(); card.remove();
    root.classList.remove('tour-on');
    if (!keepMenu) setMenu(false);
    writeTourEnd(store(), how, id);
    if (how === 'left') return;
    if (from?.isConnected) from.focus({ preventScroll: true });
    if (how === 'skipped' && firstTime) note(tour.again);
  }

  card.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
    if (!el) return;
    const act = el.dataset.act;
    if (act === 'next') show(at + 1);
    else if (act === 'back') show(at - 1);
    else if (act === 'skip') end('skipped');
    else if (act === 'done') end('done');
    else if (act === 'finish') end('done', true); // the link goes on to the next step
    else if (act === 'leave') end('left', true);
  });

  catcher.addEventListener('click', (e) => {
    const r = target && visible(target) ? target.getBoundingClientRect() : null;
    if (r && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
      // a tap on the highlighted item: leave the tour and pass the tap on
      end('left', true);
      const hit = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      (hit?.closest<HTMLElement>('a, summary, button') ?? hit)?.click();
      return;
    }
    end('skipped');
  });

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); end('skipped'); return; }
    if (e.key === 'Tab') {
      // the card and the highlighted item take turns; the rest of the page waits until the tour ends
      const own = target?.matches('a, summary, button') ? target : target?.querySelector<HTMLElement>('summary, a[href]');
      const list = [...card.querySelectorAll<HTMLElement>('button:not([hidden]), a[href]'), ...(own && visible(own) ? [own] : [])];
      if (list.length === 0) return;
      const i = list.indexOf(document.activeElement as HTMLElement);
      e.preventDefault();
      list[(i + (e.shiftKey ? -1 : 1) + list.length) % list.length].focus();
      return;
    }
    if (!card.contains(document.activeElement)) return;
    // RTL: left is forward
    if (e.key === 'ArrowLeft' && at < steps.length) { e.preventDefault(); show(at + 1); }
    else if (e.key === 'ArrowRight' && at >= 0) { e.preventDefault(); show(at - 1); }
  }

  let resizeTimer: number | undefined;
  const onResize = () => { clearTimeout(resizeTimer); resizeTimer = window.setTimeout(() => show(at), 150); };

  addEventListener('keydown', onKey, true);
  addEventListener('resize', onResize);
  show(-1);
  loop();
}

/** A short note at the top of the screen (the points-note look), gone after a few seconds. */
function note(text: string) {
  const box = h('div', { class: 'xp-toast xp-toast--guest', role: 'status', 'aria-live': 'polite' }, text);
  document.body.append(box);
  requestAnimationFrame(() => box.classList.add('xp-toast--on'));
  setTimeout(() => { box.classList.remove('xp-toast--on'); setTimeout(() => box.remove(), 400); }, 6000);
}
