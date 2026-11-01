import { LEVEL_COUNTS } from './level-counts';
import { buildInbox, openGameFrom, unread, type InboxNote, type Notice } from './inbox';
import { readLocal, updateInbox } from './progress-local';
import { INBOX_READ_MAX } from './progress-sync';

const NOTICES_KEY = 'shogi-il.inbox.notices';
const NOTICES_TTL = 30 * 60 * 1000;

async function loadNotices(): Promise<Notice[]> {
  try {
    const cached = JSON.parse(sessionStorage.getItem(NOTICES_KEY) || 'null');
    if (cached && Date.now() - cached.at < NOTICES_TTL && Array.isArray(cached.list)) return cached.list;
  } catch { }
  try {
    const { supabase } = await import('./account');
    const now = new Date().toISOString();
    const { data, error } = await supabase().from('notices').select('id, title, body, url')
      .lte('starts_at', now).or(`ends_at.is.null,ends_at.gt.${now}`).order('starts_at', { ascending: false }).limit(5);
    if (error) return [];
    try { sessionStorage.setItem(NOTICES_KEY, JSON.stringify({ at: Date.now(), list: data })); } catch { }
    return data ?? [];
  } catch {
    return [];
  }
}

function openGame() {
  try { return openGameFrom(localStorage.getItem('shogi-il.play.current')); } catch { return null; }
}

export function startInbox() {
  const found = document.querySelector<HTMLDetailsElement>('[data-inbox]');
  if (!found) return;
  const box: HTMLDetailsElement = found;
  const badge = box.querySelector<HTMLElement>('[data-inbox-count]')!;
  const list = box.querySelector<HTMLElement>('[data-inbox-list]')!;
  const label = box.querySelector<HTMLElement>('[data-inbox-label]')!;
  const weekCount = Number(box.dataset.weekCount) || 0;
  let notices: Notice[] = [];
  let shown: InboxNote[] = [];

  const notes = () => buildInbox(readLocal(), { levelCounts: LEVEL_COUNTS, weekCount, openGame: openGame(), notices });

  function draw() {
    const p = readLocal();
    const all = notes();
    const fresh = new Set(unread(all, p).map((n) => n.id));
    const count = fresh.size;
    badge.textContent = count > 9 ? '9+' : String(count);
    badge.hidden = count === 0;
    label.textContent = count ? `התראות, ${count === 1 ? 'אחת חדשה' : `${count} חדשות`}` : 'התראות';
    if (!box.open) return;
    shown = all;
    list.replaceChildren(...(all.length ? all.map((n) => item(n, fresh.has(n.id))) : [empty()]));
  }

  function item(n: InboxNote, isNew: boolean): HTMLElement {
    const li = document.createElement('li');
    li.className = isNew ? 'inbox-item new' : 'inbox-item';
    const k = document.createElement('span');
    k.className = 'inbox-kanji';
    k.lang = 'ja';
    k.setAttribute('aria-hidden', 'true');
    k.textContent = n.kanji;
    const body = document.createElement('div');
    const text = document.createElement('p');
    text.textContent = n.text;
    if (isNew) {
      const tag = document.createElement('span');
      tag.className = 'visually-hidden';
      tag.textContent = 'חדש: ';
      text.prepend(tag);
    }
    const a = document.createElement('a');
    a.href = n.href;
    a.textContent = n.cta;
    body.append(text, a);
    if (n.sub) {
      const sub = document.createElement('span');
      sub.className = 'inbox-sub';
      sub.textContent = ` · ${n.sub}`;
      body.append(sub);
    }
    li.append(k, body);
    return li;
  }

  function empty(): HTMLElement {
    const li = document.createElement('li');
    li.className = 'inbox-empty';
    li.textContent = 'אין התראות חדשות. הכול מעודכן.';
    return li;
  }

  box.addEventListener('toggle', () => {
    if (!box.open) return;
    draw();
    const p = readLocal();
    const ids = shown.map((n) => n.id).filter((id) => !p.inbox.read.includes(id));
    if (ids.length) updateInbox((i) => { i.read = [...i.read, ...ids].slice(-INBOX_READ_MAX); });
    badge.hidden = true;
    label.textContent = 'התראות';
  });
  box.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && box.open) { box.open = false; box.querySelector('summary')?.focus(); }
  });
  document.addEventListener('click', (e) => { if (box.open && !box.contains(e.target as Node)) box.open = false; });
  box.querySelectorAll('[data-inbox-panel] a').forEach((a) => a.addEventListener('click', () => { box.open = false; }));
  list.addEventListener('click', (e) => { if ((e.target as HTMLElement).closest('a')) box.open = false; });

  const redraw = () => { if (!box.open) draw(); };
  for (const ev of ['progress-synced', 'progress-reset', 'shogi-il:game-end']) document.addEventListener(ev, redraw);
  document.addEventListener('progress-changed', () => setTimeout(redraw, 0));
  window.addEventListener('storage', redraw);
  draw();
  void loadNotices().then((n) => { notices = n; draw(); });
}
