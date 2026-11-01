// AGPL-3.0-or-later, like the rest of src/learn/.
import LearnCtrl from './ctrl';
import { i18n } from './i18n';
import { currentPieceSet } from '../lib/piece-set';
import { attachKeyboard } from './keyboard';
import { type LearnPrefs, type SwitchPref, loadPrefs, savePrefs } from './prefs';
import { preloadSounds } from './sound';
import { soundControls } from './sound-prefs';
import { routeFromUrl } from './route';
import { stageSlug } from './urls';
import { el, hebrewFontSwitch, icon, mount, pieceSetSwitch, render } from './view';

const slugFromPath = (): string | undefined => window.location.pathname.match(/^\/learn\/([^/]+)\/?$/)?.[1];

const scrollToCategory = (): void => {
  const id = window.location.hash.slice(1);
  if (id.startsWith('cat-') || id.startsWith('level-')) document.getElementById(id)?.scrollIntoView();
};

export function bootLearn(root: HTMLElement): LearnCtrl {
  routeFromUrl();
  const prefs = loadPrefs();
  const { board } = mount(root);
  let ctrl: LearnCtrl;
  let queued = false;
  const redraw = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      render(ctrl, root, openSettings);
      document.dispatchEvent(new CustomEvent('learn-level'));
    });
  };

  const apply = (p: LearnPrefs) => {
    root.classList.toggle('no-coords', !p.coords);
    ctrl?.shogiground.set({
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
  const dialog = el('dialog', { class: 'learn__settings', 'aria-labelledby': 'learn-settings-title' },
    el('form', { method: 'dialog' },
      el('div', { class: 'head' },
        el('h2', { id: 'learn-settings-title' }, i18n('il_settings')),
        el('button', { type: 'submit', class: 'close', 'aria-label': i18n('il_close') }, icon('close')),
      ),
      el('fieldset', {},
        el('legend', {}, i18n('il_pieceSet')),
        pieceSetSwitch(),
      ),
      el('fieldset', { class: 'hfont-row' },
        el('legend', {}, i18n('il_hebrewFont')),
        hebrewFontSwitch(),
      ),
      el('fieldset', {},
        el('legend', {}, i18n('il_board')),
        toggle('coords', i18n('il_prefCoords')),
        toggle('dests', i18n('il_prefDests')),
        toggle('animation', i18n('il_prefAnimation')),
      ),
      el('fieldset', { class: 'sound' },
        el('legend', {}, i18n('il_prefSound')),
        soundControls('learn-snd', 'pref'),
      ),
      el('details', { class: 'kbd' },
        el('summary', {}, i18n('il_kbdTitle')),
        el('ul', {}, ...i18n('il_kbdKeys').split('|').map((line) => {
          const [k, v] = line.split('=');
          return el('li', {}, el('kbd', { dir: 'ltr' }, k.trim()), ' ', v.trim());
        })),
      ),
      el('div', { class: 'foot' },
        el('button', { type: 'button', class: 'link', onclick: () => {
          if (confirm(i18n('youWillLoseAllYourProgress'))) {
            ctrl.reset();
            ctrl.setHome();
            dialog.close();
            ctrl.redraw();
          }
        } }, i18n('resetMyProgress')),
        el('button', { type: 'submit', class: 'btn primary' }, i18n('il_close')),
      ),
    ),
  );
  root.append(dialog);
  const openSettings = () => {
    try {
      dialog.showModal();
    } catch {
      dialog.setAttribute('open', '');
    }
  };
  document.addEventListener('pieces-changed', () => {
    const set = currentPieceSet();
    dialog.querySelectorAll<HTMLButtonElement>('[data-pieces-set]').forEach((b) =>
      b.setAttribute('aria-pressed', String(b.dataset.piecesSet === set)));
  });

  ctrl = new LearnCtrl({ pref: prefs }, redraw, root.dataset.stage || slugFromPath());
  ctrl.shogiground.attach({ board });
  ctrl.shogiground.set({ events: { change: redraw } });
  apply(prefs);
  void preloadSounds();

  attachKeyboard(
    ctrl,
    root.querySelector<HTMLElement>('[data-board]')!,
    root.querySelector<HTMLElement>('[data-cursor]')!,
    root.querySelector<HTMLElement>('[data-live]')!,
  );

  window.addEventListener('popstate', () => {
    const slug = slugFromPath();
    const stage = slug && ctrl.stages.find((s) => stageSlug(s.key) === slug);
    if (stage) {
      const lvl = Number.parseInt(window.location.hash.replace('#', ''));
      ctrl.setLesson(stage.id, Number.isFinite(lvl) ? lvl : 1);
    } else {
      const hash = window.location.hash;
      ctrl.setHome();
      if (hash.startsWith('#cat-')) window.history.replaceState('', '', `/learn/${hash}`);
    }
    ctrl.redraw();
    requestAnimationFrame(() => requestAnimationFrame(scrollToCategory));
  });

  document.addEventListener('progress-synced', () => { ctrl.progress.reload(); ctrl.redraw(); });

  render(ctrl, root, openSettings);
  if (!slugFromPath()) scrollToCategory();
  root.querySelector<HTMLElement>('.learn__overlay:not([hidden]) [data-autofocus]')?.focus({ preventScroll: true });
  return ctrl;
}
