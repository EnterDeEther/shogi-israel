// Shogi Israel: entry point for the game against the computer (/play/).
// Board settings are the same ones the lessons use (one set per device): square numbers, move dots,
// animation, sound; the piece set is the site-wide letters / kanji switch.
// AGPL-3.0-or-later, like the rest of this site.
import { i18n } from '../learn/i18n';
import { attachKeyboard } from '../learn/keyboard';
import { type LearnPrefs, loadPrefs, savePrefs } from '../learn/prefs';
import { setSoundEnabled } from '../learn/sound';
import { el, icon, pieceSetSwitch } from '../learn/view';
import PlayCtrl from './ctrl';
import { engineSupport } from './engine';
import { clockText, mount, render } from './view';

export function bootPlay(root: HTMLElement): PlayCtrl {
  const prefs = loadPrefs();
  const support = engineSupport();
  const { board } = mount(root);
  let ctrl: PlayCtrl;
  let queued = false;
  const redraw = () => {
    if (queued || !ctrl) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      render(ctrl, root, openSettings, support);
    });
  };

  // ---------- settings dialog (same look as the lessons' cog wheel)
  const apply = (p: LearnPrefs) => {
    root.classList.toggle('no-coords', !p.coords);
    setSoundEnabled(p.sound);
    ctrl?.ground.set({
      movable: { showDests: p.dests },
      droppable: { showDests: p.dests },
      animation: { enabled: p.animation },
    });
  };
  const toggle = (key: keyof LearnPrefs, label: string) =>
    el('label', { class: 'pref' },
      el('input', {
        type: 'checkbox', ...(prefs[key] ? { checked: true } : {}),
        onchange: (e: Event) => {
          prefs[key] = (e.target as HTMLInputElement).checked;
          savePrefs(prefs);
          apply(prefs);
        },
      }),
      el('span', {}, label));
  const dialog = el('dialog', { class: 'learn__settings', 'aria-labelledby': 'play-settings-title' },
    el('form', { method: 'dialog' },
      el('div', { class: 'head' },
        el('h2', { id: 'play-settings-title' }, i18n('il_settings')),
        el('button', { type: 'submit', class: 'close', 'aria-label': i18n('il_close') }, icon('close')),
      ),
      el('fieldset', {}, el('legend', {}, i18n('il_pieceSet')), pieceSetSwitch()),
      el('fieldset', {},
        el('legend', {}, i18n('il_board')),
        toggle('coords', i18n('il_prefCoords')),
        toggle('dests', i18n('il_prefDests')),
        toggle('animation', i18n('il_prefAnimation')),
        toggle('sound', i18n('il_prefSound')),
      ),
      el('details', { class: 'kbd' },
        el('summary', {}, i18n('il_kbdTitle')),
        el('ul', {}, ...i18n('il_kbdKeys').split('|').map((line) => {
          const [k, v] = line.split('=');
          return el('li', {}, el('kbd', { dir: 'ltr' }, k.trim()), ' ', v.trim());
        })),
      ),
      el('div', { class: 'foot' }, el('span'), el('button', { type: 'submit', class: 'btn primary' }, i18n('il_close'))),
    ),
  );
  document.body.append(dialog);
  const openSettings = () => {
    try {
      dialog.showModal();
    } catch {
      dialog.setAttribute('open', '');
    }
  };
  document.addEventListener('pieces-changed', () => {
    const kanji = document.documentElement.dataset.pieces === 'kanji';
    document.querySelectorAll<HTMLButtonElement>('[data-pieces-set]').forEach((b) =>
      b.setAttribute('aria-pressed', String((b.dataset.piecesSet === 'kanji') === kanji)));
  });

  ctrl = new PlayCtrl(prefs, redraw);
  ctrl.ground.attach({ board });
  apply(prefs);
  ctrl.syncGround();
  if (support === 'ok' && ctrl.setupOpen) ctrl.preload();

  // The keyboard code drives the board for "your" pieces: the player's colour in this game.
  attachKeyboard(
    { shogiground: ctrl.ground, get vm() { return { level: { color: ctrl.playerColor } }; } },
    root.querySelector<HTMLElement>('[data-board]')!,
    root.querySelector<HTMLElement>('[data-cursor]')!,
    root.querySelector<HTMLElement>('[data-live]')!,
  );

  // Moves list keys (as on Lishogi): left/right step through the moves when the board isn't focused.
  document.addEventListener('keydown', (e) => {
    const t = e.target as HTMLElement;
    if (e.altKey || e.ctrlKey || e.metaKey || t.closest('input, textarea, [data-board], dialog')) return;
    if (ctrl.setupOpen) return;
    // RTL page: the right arrow goes back to earlier moves
    if (e.key === 'ArrowRight') ctrl.step(-1);
    else if (e.key === 'ArrowLeft') ctrl.step(1);
    else if (e.key === 'Home') ctrl.view(0);
    else if (e.key === 'End') ctrl.view(undefined);
    else return;
    e.preventDefault();
  });

  // Clocks: update only the digits, ten times a second.
  window.setInterval(() => {
    if (!ctrl.clock?.running) return;
    root.querySelectorAll<HTMLElement>('[data-clock]').forEach((c) => {
      const color = c.dataset.clock as Color;
      c.textContent = clockText(ctrl, color);
      c.classList.toggle('byo', ctrl.timeLeft(color).main <= 0);
    });
  }, 100);

  render(ctrl, root, openSettings, support);
  root.querySelector<HTMLElement>('.play__overlay:not([hidden]) [data-autofocus]')?.focus({ preventScroll: true });
  return ctrl;
}
