// Shogi Israel: our view for the ported Learn controller (replaces lila's snabbdom views).
// Same states and flow as lila's views/lesson.ts + overlays/starting.ts + overlays/completed.ts:
// stage intro overlay -> levels with goal, stars and progress -> stage complete overlay.
// Page is RTL; the board is LTR and never mirrors.
// AGPL-3.0-or-later, like the rest of src/learn/.
import { nextStage } from './categories';
import type LearnCtrl from './ctrl';
import { i18n, i18nFormat } from './i18n';
import { average } from './util';

// Same list and random pick as lila's views/congrats.ts
const congratsKeys = [
  'awesome', 'excellent', 'greatJob', 'perfect', 'outstanding',
  'wayToGo', 'yesYesYes', 'youreGoodAtThis', 'nailedIt', 'rightOn',
];
const congrats = () => i18n(congratsKeys[Math.floor(Math.random() * congratsKeys.length)]);

type Child = Node | string | null | undefined | false;
function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | boolean | ((e: Event) => void)> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (typeof v === 'function') e.addEventListener(k.replace(/^on/, ''), v as EventListener);
    else if (v === true) e.setAttribute(k, '');
    else if (v !== false) e.setAttribute(k, v);
  }
  for (const c of children) if (c) e.append(c);
  return e;
}

function stars(n: number, label = true): HTMLElement {
  const s = el('span', { class: `stars st${n}` });
  if (label) s.setAttribute('aria-label', `${n} מתוך 3 כוכבים`);
  for (let i = 0; i < 3; i++) s.append(el('span', { class: i < n ? 'on' : 'off', 'aria-hidden': 'true' }, '★'));
  return s;
}

/** Build the static frame once; returns the element shogiground attaches to. */
export function mount(root: HTMLElement): { board: HTMLElement } {
  root.classList.add('learn');
  root.replaceChildren(
    el('div', { class: 'learn__main' },
      el('div', { class: 'learn__board', dir: 'ltr', role: 'application', 'aria-label': i18n('il_boardLabel') },
        el('div', { class: 'learn__sg', 'data-sg': true }),
        el('div', { class: 'learn__overlay', 'data-overlay': true, hidden: true }),
      ),
    ),
    el('div', { class: 'learn__head', 'data-head': true }),
    el('div', { class: 'learn__foot', 'data-foot': true }),
  );
  return { board: root.querySelector<HTMLElement>('[data-sg]')! };
}

export function render(ctrl: LearnCtrl, root: HTMLElement): void {
  const head = root.querySelector<HTMLElement>('[data-head]')!;
  const foot = root.querySelector<HTMLElement>('[data-foot]')!;
  const overlay = root.querySelector<HTMLElement>('[data-overlay]')!;
  const vm = ctrl.vm;
  const go = (fn: () => void) => (e: Event) => { e.stopPropagation(); fn(); ctrl.redraw(); };

  // ---------- home (no lesson open): list of stages ----------
  if (!vm) {
    root.classList.remove('is-starting', 'is-completed');
    overlay.hidden = false;
    overlay.className = 'learn__overlay home';
    overlay.replaceChildren(
      el('div', { class: 'screen' },
        el('h2', {}, i18n('learn:shogiPieces')),
        el('ul', { class: 'stage-list' },
          ...ctrl.stages.map((s) => {
            const sc = ctrl.progress.get(s.key).filter(Boolean);
            return el('li', {},
              el('button', { type: 'button', class: 'btn', onclick: go(() => ctrl.setLesson(s.id)) },
                `${i18nFormat('learn:stageX', s.id)}: ${s.title}`),
              el('span', { class: 'small muted' }, ` ${sc.length} / ${s.levels.length}`),
            );
          }),
        ),
      ),
    );
    head.replaceChildren(el('h1', { class: 'title' }, i18n('learn:learnShogi')), el('p', { class: 'subtitle' }, i18n('il_spikeNote')));
    foot.replaceChildren(
      el('button', { type: 'button', class: 'link', onclick: go(() => {
        if (confirm(i18n('il_resetConfirm'))) ctrl.reset();
      }) }, i18n('il_resetProgress')),
    );
    return;
  }

  const { stage, level } = vm;
  const starting = vm.stageState === 'init';
  const completed = vm.stageState === 'completed';
  root.classList.toggle('is-starting', starting);
  root.classList.toggle('is-completed', completed);

  // ---------- overlays on the board ----------
  if (starting) {
    overlay.hidden = false;
    overlay.className = 'learn__overlay starting';
    const start = go(() => { if (ctrl.vm) ctrl.vm.stageState = 'running'; });
    overlay.replaceChildren(
      el('div', { class: 'screen' },
        el('p', { class: 'eyebrow' }, i18nFormat('learn:stageX', stage.id)),
        el('h2', {}, stage.title),
        el('p', {}, stage.intro),
        el('button', { type: 'button', class: 'btn primary', onclick: start, 'data-autofocus': true }, i18n('learn:letsGo')),
      ),
    );
    overlay.onclick = start;
  } else if (completed && !level.nextButton) {
    overlay.hidden = false;
    overlay.className = 'learn__overlay completed';
    const next = nextStage(stage.id);
    const avg = Math.floor(average(ctrl.progress.get(stage.key)));
    overlay.replaceChildren(
      el('div', { class: 'screen' },
        stars(avg),
        el('h2', {}, i18nFormat('learn:stageXComplete', stage.id)),
        el('p', {}, stage.complete),
        el('div', { class: 'buttons' },
          next && el('button', { type: 'button', class: 'btn primary', onclick: go(() => ctrl.nextLesson()) },
            `${i18n('learn:next')}: ${next.title}`),
          el('button', { type: 'button', class: 'btn', onclick: go(() => ctrl.restartLevel()) }, i18n('il_restart')),
          el('button', { type: 'button', class: 'btn', onclick: go(() => ctrl.setHome()) }, i18n('learn:backToMenu')),
        ),
      ),
    );
    overlay.onclick = go(() => { if (ctrl.vm) ctrl.vm.stageState = 'end'; });
  } else {
    overlay.hidden = true;
    overlay.onclick = null;
    overlay.replaceChildren();
  }

  // ---------- side panel ----------
  let status: HTMLElement;
  if (vm.levelState === 'fail') {
    status = el('div', { class: 'result failed', role: 'status' },
      el('strong', {}, i18n('learn:puzzleFailed')),
      el('button', { type: 'button', class: 'btn', onclick: go(() => ctrl.restartLevel()) }, i18n('learn:retry')),
    );
  } else if (vm.levelState === 'completed') {
    status = el('div', { class: 'result completed', role: 'status' },
      el('strong', {}, congrats()),
      level.nextButton || vm.stageState === 'end'
        ? el('button', { type: 'button', class: 'btn primary', onclick: go(() => ctrl.nextLesson()) }, i18n('learn:next'))
        : stars(vm.score ?? 0),
    );
  } else {
    // USI destination is always characters 2-4 ("5f5e", "4d4c+", "S*5e"), same test as ground.ts createDrawable.
    const left = (level.obstacles ?? []).filter((o) => !vm.usiCList.some((uc) => uc.usi.slice(2, 4) === o)).length;
    status = el('div', { class: 'goal', role: 'status' },
      el('p', {}, level.goal),
      level.obstacles?.length
        ? el('p', { class: 'small muted' },
            i18nFormat('il_movesMade', vm.usiCList.filter((u) => u.color === level.color).length),
            ' · ',
            left === 1 ? i18n('il_starsLeftOne') : i18nFormat('il_starsLeft', left))
        : null,
    );
  }

  const prog = ctrl.progress.get(stage.key);
  head.replaceChildren(
    el('p', { class: 'eyebrow' }, `${i18n('learn:shogiPieces')} · ${i18nFormat('learn:stageX', stage.id)}`),
    el('h1', { class: 'title' }, stage.title),
    el('p', { class: 'subtitle' }, stage.subtitle),
    el('div', { class: 'status-wrap', 'aria-live': 'polite' }, status),
  );
  foot.replaceChildren(
    el('p', { class: 'small muted lvl' }, i18nFormat('il_levelXofY', level.id, stage.levels.length)),
    el('ol', { class: 'progress', 'aria-label': i18n('il_level') },
      ...stage.levels.map((l) => {
        const score = prog[l.id - 1];
        const state = l.id === level.id ? 'active' : score ? 'done' : 'future';
        return el('li', {},
          el('button', {
            type: 'button', class: state,
            'aria-current': l.id === level.id ? 'step' : false,
            'aria-label': `${i18n('il_level')} ${l.id}${score ? `, ${score} כוכבים` : ''}`,
            onclick: go(() => ctrl.setLesson(stage.id, l.id)),
          }, score ? stars(score, false) : el('span', { class: 'id' }, String(l.id))),
        );
      }),
    ),
    el('div', { class: 'tools' },
      el('div', { class: 'seg', role: 'group', 'aria-label': 'סימון הכלים' },
        el('button', { type: 'button', 'data-pieces-set': 'letters', 'aria-pressed': String(document.documentElement.dataset.pieces !== 'kanji') }, 'אותיות'),
        el('button', { type: 'button', 'data-pieces-set': 'kanji', 'aria-pressed': String(document.documentElement.dataset.pieces === 'kanji') }, 'קאנג׳י'),
      ),
      el('button', { type: 'button', class: 'link', onclick: go(() => ctrl.restartLevel()) }, i18n('il_restart')),
      el('button', { type: 'button', class: 'link', onclick: go(() => ctrl.setHome()) }, i18n('learn:menu')),
    ),
  );
}
