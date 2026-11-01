const native = typeof HTMLElement !== 'undefined' && typeof HTMLElement.prototype.showPopover === 'function';

const HOVER_IN = 250;
const HOVER_OUT = 200;
const GAP = 10;
const EDGE = 12;

interface Open { tip: HTMLElement; btn: HTMLElement; pop: HTMLElement; pinned: boolean }
let current: Open | null = null;
let hoverTimer = 0;
let leaveTimer = 0;

const tipOf = (n: EventTarget | null): HTMLElement | null => (n instanceof Element ? n.closest<HTMLElement>('.info-tip') : null);
const part = (tip: HTMLElement, cls: string) => tip.querySelector<HTMLElement>(`.info-tip__${cls}`)!;
const shown = (pop: HTMLElement) => (native ? pop.matches(':popover-open') : pop.classList.contains('is-open'));

function place(btn: HTMLElement, pop: HTMLElement) {
  const r = btn.getBoundingClientRect();
  const w = pop.offsetWidth;
  const h = pop.offsetHeight;
  const vw = document.documentElement.clientWidth;
  const below = r.bottom + GAP + h <= innerHeight - EDGE || r.top - GAP - h < EDGE;
  const centre = r.left + r.width / 2;
  const left = Math.max(EDGE, Math.min(centre - w / 2, vw - EDGE - w));
  pop.style.top = `${Math.round(below ? r.bottom + GAP : r.top - GAP - h)}px`;
  pop.style.left = `${Math.round(left)}px`;
  pop.dataset.side = below ? 'below' : 'above';
  part(pop, 'arrow').style.left = `${Math.round(Math.max(12, Math.min(centre - left - 6, w - 24)))}px`;
}

function show(tip: HTMLElement, pinned: boolean) {
  if (current && !current.tip.isConnected) current = null;
  const btn = part(tip, 'btn');
  const pop = part(tip, 'pop');
  if (current && current.pop !== pop) hide();
  if (!shown(pop)) {
    if (native) pop.showPopover();
    else pop.classList.add('is-open');
  }
  btn.setAttribute('aria-expanded', 'true');
  current = { tip, btn, pop, pinned };
  place(btn, pop);
}

function hide() {
  clearTimeout(hoverTimer);
  clearTimeout(leaveTimer);
  if (!current) return;
  const { btn, pop } = current;
  current = null;
  if (native) { if (pop.matches(':popover-open')) pop.hidePopover(); } else pop.classList.remove('is-open');
  btn.setAttribute('aria-expanded', 'false');
}

function reposition() {
  if (!current) return;
  if (!current.btn.isConnected) { current = null; return; }
  const r = current.btn.getBoundingClientRect();
  if (r.bottom < 0 || r.top > innerHeight) hide();
  else place(current.btn, current.pop);
}

document.addEventListener('click', (e) => {
  const t = e.target;
  if (!(t instanceof Element)) return;
  const close = t.closest('.info-tip__x');
  if (close) {
    e.preventDefault();
    const tip = tipOf(close)!;
    hide();
    part(tip, 'btn').focus();
    return;
  }
  const btn = t.closest('.info-tip__btn');
  if (!btn) return;
  e.preventDefault();
  const tip = tipOf(btn)!;
  clearTimeout(hoverTimer);
  clearTimeout(leaveTimer);
  if (current?.tip === tip && shown(current.pop)) {
    if (current.pinned) hide();
    else current.pinned = true;
  } else show(tip, true);
});

document.addEventListener('pointerover', (e) => {
  if (e.pointerType !== 'mouse') return;
  const tip = tipOf(e.target);
  if (!tip) return;
  clearTimeout(leaveTimer);
  if (current?.tip === tip && shown(current.pop)) return;
  if (!(e.target as Element).closest('.info-tip__btn')) return;
  clearTimeout(hoverTimer);
  hoverTimer = window.setTimeout(() => show(tip, false), HOVER_IN);
});
document.addEventListener('pointerout', (e) => {
  if (e.pointerType !== 'mouse') return;
  const tip = tipOf(e.target);
  if (!tip || (e.relatedTarget instanceof Node && tip.contains(e.relatedTarget))) return;
  clearTimeout(hoverTimer);
  if (current?.tip === tip && !current.pinned) leaveTimer = window.setTimeout(hide, HOVER_OUT);
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || !current) return;
  const { btn, pop } = current;
  const inside = pop.contains(document.activeElement);
  hide();
  if (inside) btn.focus();
});
document.addEventListener('focusout', (e) => {
  if (!current || tipOf(e.target) !== current.tip) return;
  if (e.relatedTarget instanceof Node && !current.tip.contains(e.relatedTarget)) hide();
});

document.addEventListener('toggle', (e) => {
  const pop = e.target;
  if (!(pop instanceof HTMLElement) || !pop.classList.contains('info-tip__pop')) return;
  const open = (e as Event & { newState?: string }).newState === 'open';
  tipOf(pop)?.querySelector('.info-tip__btn')?.setAttribute('aria-expanded', String(open));
  if (!open && current?.pop === pop) current = null;
}, true);

if (!native) {
  document.addEventListener('click', (e) => {
    if (current && !current.tip.contains(e.target as Node)) hide();
  }, true);
}

addEventListener('resize', reposition);
addEventListener('scroll', reposition, { capture: true, passive: true });
