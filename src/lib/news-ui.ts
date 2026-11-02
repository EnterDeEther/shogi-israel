import { hasStoredSession } from './account-config';
import { currentGender, resolve, type Gender } from './gender';
import { NEWS_KIND, NEWS_ROUNDS, asKind, newsCta, newsDwell, newsHref, newsId, newsParts, type NewsRow, type NewsSpeed } from './news';
import { cachedNews, loadNews } from './news-data';
import { TIPS_REST_DAYS, composeBar } from './news-evergreen';
import { settingsHref } from './settings-place';
import { WEEK_LENGTH, weekIndex, weekPuzzle } from '../tsume/week';
import { readLocal, updateInbox } from './progress-local';
import { INBOX_READ_MAX } from './progress-sync';

const SPEED: NewsSpeed = 'normal';
const LATE_MS = 1500;
const REST_KEY = 'shogi-il.news.rest';
const isInstalled = () => matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
const LEARNER_KEYS = ['shogi-il.learn.progress', 'shogi-il.tsume.solved', 'shogi-il.play.history'];

function returning(): boolean {
  if (document.documentElement.hasAttribute('data-learner')) return true;
  try {
    const ls = localStorage;
    if (LEARNER_KEYS.some((k) => { const v = ls.getItem(k); return !!v && v !== '[]' && v !== '{}'; })) return true;
    for (let i = 0; i < ls.length; i++) if ((ls.key(i) || '').startsWith('done:')) return true;
  } catch { }
  return false;
}

function markRead(ids: string[]) {
  const read = readLocal().inbox.read;
  const fresh = ids.filter((id) => !read.includes(id));
  if (fresh.length) updateInbox((i) => { i.read = [...i.read, ...fresh].slice(-INBOX_READ_MAX); });
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  return e;
};

const PUNCT = /^[.,:;?)\]״"']+/;

function line(r: NewsRow, g: Gender, kit: HTMLTemplateElement): HTMLParagraphElement {
  const kind = asKind(r.kind);
  const p = el('p', 'news-line');
  const tag = el('span', 'news-tag');
  tag.dataset.kind = kind;
  const icon = kit.content.querySelector(`[data-kind-icon="${kind}"] svg`);
  if (icon) tag.append(icon.cloneNode(true));
  tag.append(NEWS_KIND[kind].label);
  p.append(tag);

  const parts = newsParts(resolve(r.title, g));
  for (let n = 0; n < parts.length; n++) {
    const part = parts[n];
    if (part.t === 'text') { p.append(part.s); continue; }
    if (part.t === 'bold') { const b = el('strong'); b.textContent = part.s; p.append(b); continue; }
    const last = p.lastChild;
    if (last && last.nodeType === Node.TEXT_NODE && last.textContent!.endsWith(' ')) last.textContent = last.textContent!.slice(0, -1) + ' ';
    const keep = el('span', 'nw');
    if (part.t === 'chip') {
      const chip = el('span', 'news-chip');
      const b = el('b');
      b.textContent = part.s;
      chip.append(b);
      keep.append(chip);
    } else {
      const chess = el('span', 'news-chess');
      chess.textContent = [...part.s].map((c) => c + '︎').join('');
      keep.append(chess);
    }
    const next = parts[n + 1];
    const tail = next?.t === 'text' ? PUNCT.exec(next.s)?.[0] : undefined;
    if (tail) { keep.append(tail); next.s = next.s.slice(tail.length); }
    p.append(keep);
  }

  const href = newsHref(r);
  const a = el('a', 'news-cta');
  a.href = href;
  a.dataset.newsId = String(r.id);
  if (/^https:/.test(href)) { a.target = '_blank'; a.rel = 'noopener'; }
  a.append(resolve(newsCta(r), g));
  const arrow = kit.content.querySelector('[data-news-arrow]');
  if (arrow) a.append(arrow.cloneNode(true));
  p.append(' ', a);
  return p;
}

interface Bar { destroy(): void }

function makeBar(root: HTMLElement, items: NewsRow[], kit: HTMLTemplateElement, onClose: () => void): Bar {
  const g = currentGender();
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let i = 0, timer = 0, outTimer = 0, round = 0, paused = false, holds = 0, left = 0, started = 0, dead = false;
  const off: (() => void)[] = [];
  const on = (t: EventTarget, ev: string, fn: EventListener, opt?: AddEventListenerOptions) => { t.addEventListener(ev, fn, opt); off.push(() => t.removeEventListener(ev, fn, opt)); };

  const card = el('div', 'news-card');
  const stage = el('div', 'news-stage');
  const els = items.map((r) => {
    const box = el('div', 'news-item');
    box.setAttribute('aria-hidden', 'true');
    box.append(line(r, g, kit));
    stage.append(box);
    return box;
  });
  const ctrl = el('div', 'news-ctrl');
  const pause = el('button', 'news-btn');
  pause.type = 'button';
  pause.append(...[...kit.content.querySelectorAll('[data-news-pause] > svg')].map((s) => s.cloneNode(true)));
  const close = el('button', 'news-btn');
  close.type = 'button';
  close.setAttribute('aria-label', resolve('⟦סגור|סגרי⟧ את העדכונים', g));
  const x = kit.content.querySelector('[data-news-close]');
  if (x) close.append(x.cloneNode(true));
  if (items.length > 1) ctrl.append(pause);
  ctrl.append(close);
  card.append(stage, ctrl);
  const segs: HTMLButtonElement[] = [];
  if (items.length > 1) {
    const row = el('div', 'news-segs');
    items.forEach((_, n) => {
      const s = el('button', 'news-seg');
      s.type = 'button';
      s.setAttribute('aria-label', `עדכון ${n + 1} מתוך ${items.length}`);
      s.append(el('i'));
      s.addEventListener('click', () => { round = 0; show(n); });
      row.append(s);
      segs.push(s);
    });
    card.append(row);
  }
  root.replaceChildren(card);
  root.classList.remove('is-closing');
  root.style.height = '';
  root.style.marginBlock = '';
  root.hidden = false;

  const dwell = (n: number) => newsDwell(resolve(items[n].title, g), resolve(newsCta(items[n]), g), SPEED);

  function show(n: number, first = false) {
    const prev = first ? -1 : i;
    clearTimeout(outTimer);
    els.forEach((e, k) => {
      e.classList.remove('is-out');
      if (k === prev && k !== n) e.classList.add('is-out');
      e.classList.toggle('is-on', k === n);
      e.setAttribute('aria-hidden', k === n ? 'false' : 'true');
      e.querySelectorAll('a').forEach((a) => { a.tabIndex = k === n ? 0 : -1; });
    });
    outTimer = window.setTimeout(() => els.forEach((e) => e.classList.remove('is-out')), 520);
    segs.forEach((s, k) => {
      s.classList.remove('is-on');
      s.classList.toggle('is-done', k < n);
      if (k === n) { void s.offsetWidth; s.classList.add('is-on'); }
      if (k === n) s.setAttribute('aria-current', 'true'); else s.removeAttribute('aria-current');
    });
    i = n;
    root.style.setProperty('--news-dwell', `${dwell(n)}ms`);
    schedule();
  }

  function schedule() {
    clearTimeout(timer);
    const still = reduce || items.length < 2;
    root.classList.toggle('is-still', still);
    if (still) return;
    left = dwell(i);
    started = Date.now();
    if (!paused && !holds) timer = window.setTimeout(next, left);
  }

  function next() {
    if (dead) return;
    const n = (i + 1) % items.length;
    if (n === 0 && ++round >= NEWS_ROUNDS) { show(0); setPaused(true); return; }
    show(n);
  }

  const setPlay = (run: boolean) => root.querySelectorAll<HTMLElement>('.news-seg.is-on i').forEach((e) => { e.style.animationPlayState = run ? 'running' : 'paused'; });

  function hold(h: boolean) {
    if (dead) return;
    const was = holds;
    holds = Math.max(0, holds + (h ? 1 : -1));
    if (holds && !was) { clearTimeout(timer); left -= Date.now() - started; setPlay(false); }
    else if (!holds && was && !paused && !root.classList.contains('is-still')) { started = Date.now(); timer = window.setTimeout(next, Math.max(400, left)); setPlay(true); }
  }

  function setPaused(p: boolean) {
    paused = p;
    root.classList.toggle('is-paused', p);
    pause.setAttribute('aria-label', p ? 'המשך העדכונים' : 'עצירת העדכונים');
    pause.setAttribute('aria-pressed', String(p));
    if (p) { clearTimeout(timer); left -= Date.now() - started; setPlay(false); return; }
    if (round >= NEWS_ROUNDS) round = 0;
    if (holds) return;
    started = Date.now();
    setPlay(true);
    if (left < 400) next(); else timer = window.setTimeout(next, left);
  }

  pause.addEventListener('click', () => setPaused(!paused));
  close.addEventListener('click', () => {
    root.style.height = `${root.offsetHeight}px`;
    void root.offsetHeight;
    root.classList.add('is-closing');
    root.style.height = '0px';
    root.style.marginBlock = '0px';
    api.destroy();
    window.setTimeout(() => { root.hidden = true; onClose(); }, 220);
  });
  stage.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[data-news-id]');
    if (a && Number(a.dataset.newsId) > 0) markRead([newsId(Number(a.dataset.newsId))]);
  });

  let hovered = false, focused = false, offscreen = false, touch = 0;
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    on(card, 'mouseenter', () => { if (!hovered) { hovered = true; hold(true); } });
    on(card, 'mouseleave', () => { if (hovered) { hovered = false; hold(false); } });
  }
  on(card, 'focusin', () => { if (!focused) { focused = true; hold(true); } });
  on(card, 'focusout', (e) => { if (focused && !card.contains((e as FocusEvent).relatedTarget as Node)) { focused = false; hold(false); } });
  on(card, 'touchstart', () => { clearTimeout(touch); if (!touch) hold(true); touch = -1; }, { passive: true });
  on(card, 'touchend', () => { touch = window.setTimeout(() => { touch = 0; hold(false); }, 1200); }, { passive: true });
  let hidden = document.hidden;
  if (hidden) hold(true);
  on(document, 'visibilitychange', () => { if (document.hidden !== hidden) { hidden = document.hidden; hold(hidden); } });
  const io = 'IntersectionObserver' in window ? new IntersectionObserver(([en]) => { const out = !en.isIntersecting; if (out !== offscreen) { offscreen = out; hold(out); } }) : null;
  io?.observe(root);

  const api: Bar = {
    destroy() {
      if (dead) return;
      dead = true;
      clearTimeout(timer);
      clearTimeout(outTimer);
      clearTimeout(touch);
      io?.disconnect();
      off.forEach((f) => f());
    },
  };
  show(0, true);
  return api;
}

function weekOpen(count: number): boolean {
  if (!count) return false;
  const solved = readLocal().tsume[String(WEEK_LENGTH)] ?? [];
  return !solved.includes(weekPuzzle(weekIndex(), count));
}

function restUntil(): number {
  try { return Number(localStorage.getItem(REST_KEY)) || 0; } catch { return 0; }
}

export function startNews(root: HTMLElement) {
  const kit = root.querySelector<HTMLTemplateElement>('template[data-news-kit]');
  if (!kit) return;
  root.removeChild(kit);
  const weekCount = Number(root.dataset.weekCount) || 0;
  let rows: NewsRow[] = [];
  let shown = '';
  let bar: Bar | null = null;
  let closed = false;

  function render(list: NewsRow[], force = false) {
    rows = list;
    if (closed) return;
    const p = readLocal();
    const now = Date.now();
    const back = returning();
    const off = p.inbox.off.includes('news');
    const signedIn = hasStoredSession();
    const { news: real, tips: extra } = composeBar(list, { now, returning: back, signedIn, read: p.inbox.read, off }, {
      returning: back || signedIn, installed: isInstalled(), path: location.pathname, weekOpen: weekOpen(weekCount),
      links: { settings: settingsHref(), whatsapp: root.dataset.whatsapp, facebook: root.dataset.facebook }, restUntil: restUntil(),
    });
    const pick = [...real, ...extra];
    const key = pick.map((r) => `${r.id}|${r.kind}|${r.title}|${r.cta_label}|${r.url}`).join('\n');
    if (key === shown && !force) return;
    shown = key;
    bar?.destroy();
    bar = null;
    if (!pick.length) { root.hidden = true; root.replaceChildren(); return; }
    bar = makeBar(root, pick, kit!, () => {
      closed = true;
      markRead(real.map((r) => newsId(r.id)));
      if (extra.length) { try { localStorage.setItem(REST_KEY, String(Date.now() + TIPS_REST_DAYS * 864e5)); } catch { } }
    });
  }

  const cache = cachedNews();
  let late = 0;
  if (cache) render(cache.list);
  else late = window.setTimeout(() => render([]), LATE_MS);
  void loadNews(true).then((list) => {
    clearTimeout(late);
    render(list);
  });
  for (const ev of ['progress-changed', 'progress-synced', 'progress-reset']) document.addEventListener(ev, () => setTimeout(() => render(rows), 0));
  document.addEventListener('gender-changed', () => render(rows, true));
}
