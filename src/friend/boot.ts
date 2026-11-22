// AGPL-3.0-or-later, like the rest of this site.
import { loadPrefs } from '../learn/prefs';
import { preloadSounds } from '../learn/sound';
import { mount } from '../play/view';
import { accountsEnabled } from '../lib/account-config';
import { setBugContext } from './bug';
import { gameUrl, offerSeat, signedIn } from './client';
import type { Ping } from './core';
import FriendCtrl from './ctrl';
import { clockText, hoursText, render } from './view';

const GAP = { up: 60_000, down: 15_000, clockUp: 10_000, clockDown: 4_000 };
const PING_GAP_MS = 1500;
const SOFT_GAP_MS = 3000;
const AWAKE_MS = 180_000;
const ASK_GAP_MS = 2000;
const ASK_FAST_MS = 300_000;

type WakeLock = { release(): Promise<void> };

function gameId(): string | null {
  const m = /^([0-9a-f-]{36})(?:\.([A-Za-z0-9_-]{43}))?$/i.exec(location.hash.replace(/^#/, '').trim());
  if (!m) return null;
  if (m[2]) {
    offerSeat(m[1], m[2]);
    history.replaceState(null, '', `${location.pathname}#${m[1]}`);
  }
  return m[1];
}

async function listen(id: string, onPing: (ping: Ping) => void, onLine: (up: boolean) => void): Promise<() => void> {
  if (!accountsEnabled) return () => {};
  try {
    const { supabase } = await import('../lib/account');
    const ch = supabase().channel(`fg:${id}`, { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'changed' }, (m: { payload?: unknown }) => onPing(m.payload && typeof m.payload === 'object' ? (m.payload as Ping) : {}))
      .subscribe((status) => onLine(status === 'SUBSCRIBED'));
    return () => { void supabase().removeChannel(ch); };
  } catch {
    return () => {};
  }
}

export async function bootFriendGame(root: HTMLElement): Promise<void> {
  const id = gameId();
  const prefs = loadPrefs();
  const { board } = mount(root);
  root.classList.toggle('no-coords', !prefs.coords);
  let ctrl: FriendCtrl;
  let me = false;
  let queued = false;
  const draw = () => render(ctrl, root, { signedIn: me, onRematch });
  const redraw = () => {
    if (queued || !ctrl) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; draw(); });
  };
  const onRematch = async () => {
    const next = await ctrl.rematch();
    if (next) location.assign(gameUrl(next));
  };

  ctrl = new FriendCtrl(id ?? '', prefs, redraw);
  setBugContext(() => ({
    id: id ?? undefined,
    context: `status=${ctrl.game?.status ?? 'none'} speed=${ctrl.game?.speed ?? '-'} ply=${ctrl.game?.ply ?? '-'} you=${ctrl.game?.you ?? '-'} guest=${ctrl.game ? ctrl.game.guest[ctrl.game.you] : '-'} error=${ctrl.loadError ?? '-'} pending=${ctrl.pending} alert=${ctrl.alert ? 1 : 0}`,
  }));
  ctrl.ground.attach({ board });
  void preloadSounds();
  draw();
  if (!id) {
    ctrl.loadError = 'no-game';
    draw();
    return;
  }
  me = await signedIn();
  await ctrl.load();
  if (new URLSearchParams(location.search).has('end')) {
    history.replaceState(null, '', `${location.pathname}${location.hash}`);
    if (ctrl.active) { ctrl.menu = 'end'; draw(); }
  }

  let busy = false;
  let up = false;
  let want = 0;
  let pulledAt = Date.now();
  let timer: number | undefined;
  let wake: WakeLock | null = null;
  const since = () => Date.now() - Math.max(pulledAt, ctrl.synced);
  const pull = async () => {
    if (busy || ctrl.pending) return;
    busy = true;
    want = 0;
    pulledAt = Date.now();
    try { await ctrl.load(); } finally { busy = false; }
    kick();
  };
  const kick = () => {
    if (busy || ctrl.pending || timer !== undefined || want <= (ctrl.game?.rev ?? 0)) return;
    const wait = pulledAt + PING_GAP_MS - Date.now();
    if (wait <= 0) return void pull();
    timer = window.setTimeout(() => { timer = undefined; kick(); }, wait);
  };
  const soft = () => { if (since() > SOFT_GAP_MS) void pull(); };
  const onPing = (ping: Ping) => {
    const g = ctrl.game;
    if (g && typeof ping.rev === 'number' && ping.rev <= g.rev) return;
    want = typeof ping.rev === 'number' ? Math.max(want, ping.rev) : Infinity;
    pingAt = Date.now();
    ctrl.hint(ping);
    kick();
  };
  let pingAt = 0;
  let askedAt = 0;
  const clearAlerts = () => {
    if (document.visibilityState !== 'visible' || !('serviceWorker' in navigator)) return;
    void navigator.serviceWorker.getRegistration()
      .then((reg) => reg?.getNotifications({ tag: `friend-${id}` }))
      .then((list) => list?.forEach((n) => n.close()))
      .catch(() => {});
  };
  const keepAwake = () => {
    const on = ctrl.active && document.visibilityState === 'visible' && (!!ctrl.game?.clock || Date.now() - ctrl.movedAt < AWAKE_MS);
    const nav = navigator as Navigator & { wakeLock?: { request(type: 'screen'): Promise<WakeLock> } };
    if (on && !wake && nav.wakeLock) nav.wakeLock.request('screen').then((w) => { wake = w; }, () => {});
    else if (!on && wake) { void wake.release().catch(() => {}); wake = null; }
  };
  const stop = await listen(id, onPing, (line) => {
    up = line;
    if (line) soft();
  });
  window.setInterval(() => {
    keepAwake();
    if (document.visibilityState !== 'visible') return;
    if (Date.now() - pingAt < 15_000) clearAlerts();
    kick();
    const g = ctrl.game;
    const waiting = !ctrl.ended || (!!g?.rematchBy && !g.rematchId);
    const asking = !!g && (ctrl.active ? g.takebackBy === g.you || g.endBy === g.you : ctrl.ended && g.rematchBy === g.you && !g.rematchId);
    askedAt = asking ? askedAt || Date.now() : 0;
    const clock = !!g?.clock && ctrl.active;
    const gap = asking && Date.now() - askedAt < ASK_FAST_MS ? ASK_GAP_MS : clock ? (up ? GAP.clockUp : GAP.clockDown) : up ? GAP.up : GAP.down;
    if ((waiting && since() >= gap) || (ctrl.hinted && since() >= SOFT_GAP_MS)) void pull();
  }, 2000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    wake = null;
    keepAwake();
    clearAlerts();
    soft();
  });
  clearAlerts();
  window.addEventListener('online', soft);
  window.addEventListener('hashchange', () => {
    stop();
    location.reload();
  });
  window.addEventListener('pagehide', () => stop(), { once: true });

  document.addEventListener('keydown', (e) => {
    const t = e.target as HTMLElement;
    if (e.altKey || e.ctrlKey || e.metaKey || t.closest('input, textarea, [data-board], dialog')) return;
    if (e.key === 'ArrowRight') ctrl.step(-1);
    else if (e.key === 'ArrowLeft') ctrl.step(1);
    else if (e.key === 'Home') ctrl.view(0);
    else if (e.key === 'End') ctrl.view(undefined);
    else return;
    e.preventDefault();
  });

  window.setInterval(() => {
    if (!ctrl.active) return;
    root.querySelectorAll<HTMLElement>('[data-clock]').forEach((c) => {
      const color = c.dataset.clock as Color;
      c.textContent = clockText(ctrl, color);
      c.classList.toggle('byo', ctrl.timeLeft(color).main <= 0);
    });
    const left = ctrl.deadlineLeft();
    root.querySelectorAll<HTMLElement>('[data-deadline-left]').forEach((d) => {
      d.textContent = left === null ? '' : hoursText(Math.max(0, left));
    });
  }, 250);
}
