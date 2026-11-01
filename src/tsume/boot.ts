// AGPL-3.0-or-later, like the rest of this site.
import { i18n } from '../learn/i18n';
import { attachKeyboard } from '../learn/keyboard';
import { type LearnPrefs, type SwitchPref, loadPrefs, savePrefs } from '../learn/prefs';
import { preloadSounds } from '../learn/sound';
import { soundControls } from '../learn/sound-prefs';
import { el, hebrewFontSwitch, icon, pieceSetSwitch } from '../learn/view';
import TsumeCtrl from './ctrl';
import { type Length, loadPuzzles, nextUnsolved } from './puzzles';
import { mount, render } from './view';

export async function bootTsume(root: HTMLElement): Promise<void> {
  const n = Number(root.dataset.n) as Length;
  const prefs = loadPrefs();
  const puzzles = await loadPuzzles(n);
  const { board } = mount(root);
  let ctrl: TsumeCtrl;
  let queued = false;
  const redraw = () => {
    if (queued || !ctrl) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      render(ctrl, root, openSettings);
    });
  };

  const apply = (p: LearnPrefs) => {
    root.classList.toggle('no-coords', !p.coords);
    ctrl?.ground.set({
      movable: { showDests: p.dests },
      droppable: { showDests: p.dests },
      animation: { enabled: p.animation },
    });
  };
  const toggle = (key: SwitchPref, label: string) =>
    el('label', { class: 'pref' },
      el('input', {
        type: 'checkbox', ...(prefs[key] ? { checked: true } : {}),
        onchange: (e: Event) => {
          prefs[key] = (e.target as HTMLInputElement).checked;
          savePrefs({ ...loadPrefs(), [key]: prefs[key] });
          apply(prefs);
        },
      }),
      el('span', {}, label));
  const dialog = el('dialog', { class: 'learn__settings', 'aria-labelledby': 'tsume-settings-title' },
    el('form', { method: 'dialog' },
      el('div', { class: 'head' },
        el('h2', { id: 'tsume-settings-title' }, i18n('il_settings')),
        el('button', { type: 'submit', class: 'close', 'aria-label': i18n('il_close') }, icon('close')),
      ),
      el('fieldset', {}, el('legend', {}, i18n('il_pieceSet')), pieceSetSwitch()),
      el('fieldset', { class: 'hfont-row' }, el('legend', {}, i18n('il_hebrewFont')), hebrewFontSwitch()),
      el('fieldset', {},
        el('legend', {}, i18n('il_board')),
        toggle('coords', i18n('il_prefCoords')),
        toggle('dests', i18n('il_prefDests')),
        toggle('animation', i18n('il_prefAnimation')),
      ),
      el('fieldset', { class: 'sound' },
        el('legend', {}, i18n('il_prefSound')),
        soundControls('tsume-snd', 'pref'),
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

  ctrl = new TsumeCtrl(n, puzzles, prefs, redraw);
  ctrl.ground.attach({ board });
  apply(prefs);
  void preloadSounds();

  const fromHash = (): number | undefined => {
    const id = Number.parseInt(window.location.hash.slice(1));
    return Number.isFinite(id) && id >= 1 && id <= puzzles.length ? id : undefined;
  };
  const start = fromHash() ?? nextUnsolved(n, puzzles.length);
  if (!fromHash()) window.history.replaceState(null, '', `#${start}`);
  ctrl.load(start);
  window.addEventListener('hashchange', () => {
    const id = fromHash();
    if (id) ctrl.load(id);
    root.scrollIntoView({ block: 'nearest' });
  });

  attachKeyboard(
    { shogiground: ctrl.ground, get vm() { return { level: { color: 'sente' } }; } },
    root.querySelector<HTMLElement>('[data-board]')!,
    root.querySelector<HTMLElement>('[data-cursor]')!,
    root.querySelector<HTMLElement>('[data-live]')!,
  );
  document.addEventListener('keydown', (e) => {
    const t = e.target as HTMLElement;
    if (!ctrl.done || e.altKey || e.ctrlKey || e.metaKey || t.closest('input, textarea, [data-board], dialog')) return;
    if (e.key === 'ArrowRight') ctrl.stepView(-1);
    else if (e.key === 'ArrowLeft') ctrl.stepView(1);
    else return;
    e.preventDefault();
  });
  render(ctrl, root, openSettings);
}
