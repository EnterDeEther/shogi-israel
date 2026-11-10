// AGPL-3.0-or-later, like the rest of this site.
import { loadPrefs } from '../learn/prefs';
import { preloadSounds } from '../learn/sound';
import { mount } from '../play/view';
import { accountsEnabled } from '../lib/account-config';
import { gameUrl, signedIn } from './client';
import FriendCtrl from './ctrl';
import { clockText, hoursText, render } from './view';

const POLL_MS = 20_000;

function gameId(): string | null {
  const id = location.hash.replace(/^#/, '').trim();
  return /^[0-9a-f-]{36}$/i.test(id) ? id : null;
}

async function listen(id: string, onChange: () => void): Promise<() => void> {
  if (!accountsEnabled) return () => {};
  try {
    const { supabase } = await import('../lib/account');
    const ch = supabase().channel(`fg:${id}`, { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'changed' }, onChange)
      .subscribe();
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

  let busy = false;
  const refresh = async () => {
    if (busy || ctrl.pending) return;
    busy = true;
    try { await ctrl.load(); } finally { busy = false; }
  };
  const stop = await listen(id, () => void refresh());
  window.setInterval(() => {
    if (document.visibilityState === 'visible' && (!ctrl.ended || (ctrl.game?.rematchBy && !ctrl.game.rematchId))) void refresh();
  }, POLL_MS);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void refresh(); });
  window.addEventListener('online', () => void refresh());
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
