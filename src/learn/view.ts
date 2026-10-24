// Shogi Israel: our view for the ported Learn controller (replaces lila's snabbdom views).
// Same screens and flow as lila's views: home.ts (stage map + progress + "what next"), lesson.ts
// (side map with the back button, board, table with title, goal and level progress), side.ts,
// overlays/starting.ts and overlays/completed.ts; plus our settings dialog (the cog wheel).
// Page is RTL; the board is LTR and never mirrors. Plain DOM, no snabbdom.
// AGPL-3.0-or-later, like the rest of src/learn/.
import { categories, nextStage } from './categories';
import type LearnCtrl from './ctrl';
import { i18n, i18nFormat } from './i18n';
import type { Stage } from './interfaces';
import { stageUrl } from './urls';
import { average } from './util';

// Same list and random pick as lila's views/congrats.ts
const congratsKeys = [
  'awesome', 'excellent', 'greatJob', 'perfect', 'outstanding',
  'wayToGo', 'yesYesYes', 'youreGoodAtThis', 'nailedIt', 'rightOn',
];
const congrats = () => i18n(congratsKeys[Math.floor(Math.random() * congratsKeys.length)]);

type Child = Node | string | null | undefined | false;
type Attrs = Record<string, string | boolean | undefined | ((e: Event) => void)>;
export function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs?: Attrs, ...children: Child[]): HTMLElementTagNameMap[K];
export function el(tag: string, attrs?: Attrs, ...children: Child[]): HTMLElement;
export function el(tag: string, attrs: Attrs = {}, ...children: Child[]): HTMLElement {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (typeof v === 'function') e.addEventListener(k.replace(/^on/, ''), v as EventListener);
    else if (v === true) e.setAttribute(k, '');
    else if (typeof v === 'string') e.setAttribute(k, v);
  }
  for (const c of children) if (c) e.append(c);
  return e;
}

/** Our strings use **bold** for a new term, and moves like P-76 must stay left-to-right. */
export function rich(text: string): DocumentFragment {
  const f = document.createDocumentFragment();
  text.split(/(\*\*[^*]+\*\*|\+?[KRBGSNLP]-\d\d\+?)/).forEach((part, i) => {
    if (!part) return;
    if (i % 2 === 0) f.append(part);
    else if (part.startsWith('**')) f.append(el('strong', {}, part.slice(2, -2)));
    else f.append(el('bdi', { dir: 'ltr' }, part));
  });
  return f;
}

function stars(n: number, label = true): HTMLElement {
  const s = el('span', { class: `stars st${n}` });
  if (label) {
    s.setAttribute('role', 'img');
    s.setAttribute('aria-label', i18nFormat('il_starsXofThree', n));
  }
  for (let i = 0; i < 3; i++) s.append(el('span', { class: i < n ? 'on' : 'off', 'aria-hidden': 'true' }, '★'));
  return s;
}

// ---------- stage pictures: our own (Lishogi's are game-icons.net art) ----------
// Piece stages show the piece itself (letters or kanji, follows the site switch); the others a seal with one kanji.
const pieceStages: Record<string, string> = {
  king: 'king', gold: 'gold', silver: 'silver', knight: 'knight',
  lance: 'lance', bishop: 'bishop', rook: 'rook', pawn: 'pawn',
};
const sealStages: Record<string, string> = {
  introduction: '始', capture: '取', drop: '打', protection: '守', check1: '手',
  outOfCheck: '逃', checkmate1: '詰', setup: '並', repetition: '千', value: '価',
};
export function stageImg(key: string): HTMLElement {
  const role = pieceStages[key];
  if (role) return el('span', { class: 'stage-img piece-img', 'aria-hidden': 'true' }, el('piece', { class: `${role} sente` }));
  return el('span', { class: 'stage-img seal-img', 'aria-hidden': 'true', lang: 'ja' }, sealStages[key] ?? '将');
}
const sealImg = (ch: string) => el('span', { class: 'stage-img seal-img', 'aria-hidden': 'true', lang: 'ja' }, ch);

/** Lishogi's stage status: done (all levels solved), ongoing (the next one to play), future. */
function stageStatuses(ctrl: LearnCtrl): Map<string, 'done' | 'ongoing' | 'future'> {
  const out = new Map<string, 'done' | 'ongoing' | 'future'>();
  let prevComplete = true;
  for (const s of ctrl.stages) {
    const res = ctrl.progress.get(s.key).filter((x) => x > 0);
    if (res.length === s.levels.length) out.set(s.key, 'done');
    else if (prevComplete || res.length > 0) {
      out.set(s.key, 'ongoing');
      prevComplete = false;
    } else out.set(s.key, 'future');
  }
  return out;
}

function percentage(ctrl: LearnCtrl): number {
  const max = ctrl.stages.reduce((a, s) => a + s.levels.length, 0) * 3;
  const total = Object.values(ctrl.progress.progress.stages).reduce(
    (a, st) => a + (st?.scores ?? []).reduce((x: number, y: number) => x + (y || 0), 0),
    0,
  );
  return Math.round((total / max) * 100);
}

/** Frame built once: shogiground attaches to [data-sg] and stays attached between screens. */
export function mount(root: HTMLElement): { board: HTMLElement } {
  root.classList.add('learn');
  root.replaceChildren(
    el('div', { class: 'learn__side', 'data-side': true }),
    el('div', { class: 'learn__main' },
      el('div', { class: 'learn__back-narrow', 'data-back-narrow': true }),
      el('div', {
        class: 'learn__board', dir: 'ltr', tabindex: '0', role: 'application',
        'aria-roledescription': i18n('il_boardRole'), 'aria-label': i18n('il_boardLabel'),
        'aria-describedby': 'learn-kbd-help', 'data-board': true,
      },
        el('div', { class: 'learn__sgbox' },
          el('div', { class: 'learn__sg', 'data-sg': true }),
          el('div', { class: 'kbd-cursor', 'aria-hidden': 'true', 'data-cursor': true }),
          el('div', { class: 'learn__overlay', 'data-overlay': true, hidden: true }),
        ),
      ),
      el('p', { class: 'sr-only', id: 'learn-kbd-help' }, i18n('il_kbdHelp')),
      el('div', { class: 'sr-only', 'aria-live': 'polite', 'data-live': true }),
      el('div', { 'data-info': true }),
    ),
    el('div', { class: 'learn__table', 'data-table': true }),
    el('div', { class: 'learn__map', 'data-map': true }),
  );
  return { board: root.querySelector<HTMLElement>('[data-sg]')! };
}

let lastStageKey: string | undefined | null = null; // null = nothing rendered yet

export function render(ctrl: LearnCtrl, root: HTMLElement, openSettings: () => void): void {
  // Re-rendering replaces buttons; keep keyboard focus on the "same" control (WCAG 2.4.3).
  const focusedId = (document.activeElement as HTMLElement | null)?.dataset?.fid;
  const vm = ctrl.vm;
  const q = <T extends HTMLElement = HTMLElement>(s: string) => root.querySelector<T>(s)!;
  const go = (fn: () => void) => (e: Event) => { e.preventDefault(); e.stopPropagation(); fn(); ctrl.redraw(); };
  const stageLink = (s: Stage, cls: string, ...children: Child[]) =>
    el('a', { href: stageUrl(s.key), class: cls, 'data-fid': `stage-${cls.split(' ')[0]}-${s.key}`, onclick: go(() => ctrl.setLesson(s.id)) }, ...children);
  const statuses = stageStatuses(ctrl);

  root.classList.toggle('learn--map', !vm);
  root.classList.toggle('learn--run', !!vm);
  document.title = vm
    ? `${vm.stage.title} · ${i18n('il_interactiveLesson')} · שוגי ישראל`
    : `${i18n('il_interactiveLessons')} · שוגי ישראל`;

  if (!vm) renderHome(ctrl, root, q, go, stageLink, statuses);
  else renderLesson(ctrl, root, q, go, stageLink, statuses, openSettings);

  // focus: same control as before, or the new screen's first thing when the stage changed
  const stageKey = vm?.stage.key;
  const stageChanged = lastStageKey !== null && stageKey !== lastStageKey;
  lastStageKey = stageKey;
  const again = focusedId && root.querySelector<HTMLElement>(`[data-fid="${focusedId}"]`);
  if (again) again.focus({ preventScroll: true });
  else if (stageChanged) root.querySelector<HTMLElement>('[data-autofocus]')?.focus({ preventScroll: true });
}

type Q = <T extends HTMLElement = HTMLElement>(s: string) => T;
type Go = (fn: () => void) => (e: Event) => void;
type StageLink = (s: Stage, cls: string, ...children: Child[]) => HTMLAnchorElement;

// ---------- home: lila views/home.ts ----------
function renderHome(ctrl: LearnCtrl, _root: HTMLElement, q: Q, go: Go, stageLink: StageLink, statuses: Map<string, string>) {
  const pct = percentage(ctrl);
  q('[data-overlay]').hidden = true;
  q('[data-info]').replaceChildren();
  q('[data-back-narrow]').replaceChildren();
  q('[data-table]').replaceChildren();
  q('[data-side]').replaceChildren(
    el('div', { class: `learn__side-home${pct === 100 ? ' done' : ''}` },
      el('div', { class: 'fat', 'aria-hidden': 'true', lang: 'ja' }, '将'),
      el('h1', { tabindex: '-1', 'data-autofocus': true }, i18n('learnShogi')),
      el('p', { class: 'by-playing' }, i18n('byPlaying')),
      el('div', { class: 'progress-bar' },
        el('div', { class: 'text', id: 'learn-pct' }, i18nFormat('progressX', `${pct}%`)),
        el('div', { class: 'track', role: 'progressbar', 'aria-labelledby': 'learn-pct', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(pct) },
          el('div', { class: 'bar', style: `width:${pct}%` })),
      ),
      pct > 0 &&
        el('button', { type: 'button', class: 'link', 'data-fid': 'reset', onclick: go(() => {
          if (confirm(i18n('youWillLoseAllYourProgress'))) ctrl.reset();
        }) }, i18n('resetMyProgress')),
    ),
  );

  const ribbon = (s: Stage, status: string) => {
    if (status === 'future') return null;
    const res = ctrl.progress.get(s.key).filter((x) => x > 0);
    const content: Child =
      status === 'ongoing'
        ? res.length > 0 ? el('bdi', { dir: 'ltr' }, `${res.length} / ${s.levels.length}`) : i18n('play')
        : stars(Math.floor(average(res)));
    return el('span', { class: `ribbon ${status}` }, content);
  };

  const whatNext = (href: string, seal: string, title: string, subtitle: string) =>
    el('a', { href, class: 'stage ongoing', rel: href.startsWith('http') ? 'noopener' : undefined },
      sealImg(seal), el('span', { class: 'text' }, el('h3', {}, title), el('span', { class: 'subtitle' }, subtitle)));

  q('[data-map]').replaceChildren(
    ...categories.map((c) =>
      el('section', { class: 'categ', 'aria-labelledby': `cat-${c.key}` },
        el('h2', { id: `cat-${c.key}` }, c.name),
        el('div', { class: 'categ_stages' },
          ...c.stages.map((s) => {
            const status = statuses.get(s.key)!;
            const res = ctrl.progress.get(s.key).filter((x) => x > 0);
            const a = stageLink(s, `stage ${status}`,
              ribbon(s, status),
              stageImg(s.key),
              el('span', { class: 'text' },
                el('h3', {}, s.title),
                el('span', { class: 'subtitle' }, s.subtitle),
                el('span', { class: 'sr-only' }, ` · ${i18nFormat('il_levelsDone', res.length, s.levels.length)}`)),
            );
            return a;
          }),
        ),
      ),
    ),
    el('section', { class: 'categ what-next', 'aria-labelledby': 'cat-next' },
      el('h2', { id: 'cat-next' }, i18n('whatNext')),
      el('p', {}, i18n('youKnowHowToPlayShogi')),
      el('div', { class: 'categ_stages' },
        whatNext('/rules/', '書', i18n('il_rulesCourse'), i18n('il_rulesCourseSub')),
        whatNext('https://lishogi.org/signup', '登', i18n('register'), i18n('getAFreeLishogiAccount')),
        whatNext('https://lishogi.org/training', '練', i18n('practice'), i18n('exerciseYourTacticalSkills')),
        whatNext('https://lishogi.org/', '対', i18n('playPeople'), i18n('opponentsFromAroundTheWorld')),
        whatNext('https://lishogi.org/#ai', '機', i18n('playMachine'), i18n('testYourSkillsWithTheComputer')),
      ),
    ),
  );
}

// ---------- lesson: lila views/lesson.ts + side.ts + overlays ----------
function renderLesson(ctrl: LearnCtrl, root: HTMLElement, q: Q, go: Go, stageLink: StageLink, statuses: Map<string, string>, openSettings: () => void) {
  const vm = ctrl.vm!;
  const { stage, level } = vm;
  const starting = vm.stageState === 'init';
  const completed = vm.stageState === 'completed' && !level.nextButton;
  root.classList.toggle('is-starting', starting);
  root.classList.toggle('is-completed', completed);
  q('[data-map]').replaceChildren();

  const backLink = (cls: string, fid: string) =>
    el('a', { href: '/learn/', class: cls, 'data-fid': fid, onclick: go(() => ctrl.setHome()) },
      sealImg('将'), el('span', {}, i18n('menu')));

  // side: back to the menu + all stages, current category open (lila side.ts)
  q('[data-side]').replaceChildren(
    el('nav', { class: 'learn__side-map', 'aria-label': i18n('il_allStages') },
      backLink('back', 'back'),
      ...categories.map((c) => {
        const open = c.key === vm.sideCategory;
        return el('div', { class: `categ${open ? ' active' : ''}` },
          el('button', {
            type: 'button', class: 'categ-head', 'aria-expanded': String(open), 'data-fid': `cat-${c.key}`,
            onclick: go(() => { vm.sideCategory = c.key; }),
          }, c.name),
          open && el('ul', { class: 'categ_stages' },
            ...c.stages.map((s) => {
              const st = s.key === stage.key ? 'active' : statuses.get(s.key) === 'done' ? 'done' : 'future';
              const a = stageLink(s, `stage ${st}`, stageImg(s.key), el('span', {}, s.title));
              if (st === 'active') a.setAttribute('aria-current', 'page');
              if (st === 'done') a.append(el('span', { class: 'sr-only' }, ` · ${i18n('il_done')}`));
              return el('li', {}, a);
            }),
          ),
        );
      }),
    ),
  );
  q('[data-back-narrow]').replaceChildren(backLink('back-narrow', 'back-narrow'));

  // overlays on the board (lila overlays/starting.ts, overlays/completed.ts)
  const overlay = q('[data-overlay]');
  if (starting) {
    overlay.hidden = false;
    overlay.className = 'learn__overlay starting';
    const start = go(() => { vm.stageState = 'running'; });
    overlay.replaceChildren(
      el('div', { class: 'screen', role: 'dialog', 'aria-labelledby': 'learn-ov-title' },
        stageImg(stage.key),
        el('p', { class: 'eyebrow' }, i18nFormat('stageX', stage.id)),
        el('h2', { id: 'learn-ov-title' }, stage.title),
        el('p', {}, rich(stage.intro)),
        el('button', { type: 'button', class: 'btn primary', onclick: start, 'data-autofocus': true, 'data-fid': 'letsgo' }, i18n('letsGo')),
      ),
    );
    overlay.onclick = start;
  } else if (completed) {
    overlay.hidden = false;
    overlay.className = 'learn__overlay completed';
    const next = nextStage(stage.id);
    const avg = Math.floor(average(ctrl.progress.get(stage.key)));
    overlay.replaceChildren(
      el('div', { class: 'screen', role: 'dialog', 'aria-labelledby': 'learn-ov-title' },
        stars(avg),
        el('h2', { id: 'learn-ov-title' }, i18nFormat('stageXComplete', stage.id)),
        el('p', {}, rich(stage.complete)),
        el('div', { class: 'buttons' },
          next
            ? el('button', { type: 'button', class: 'btn primary', 'data-autofocus': true, 'data-fid': 'ov-next', onclick: go(() => ctrl.nextLesson()) },
                `${i18n('next')}: ${next.title}`)
            : el('a', { href: '/learn/', class: 'btn primary', 'data-autofocus': true, 'data-fid': 'ov-next', onclick: go(() => ctrl.setHome()) }, i18n('whatNext')),
          el('button', { type: 'button', class: 'btn', 'data-fid': 'ov-menu', onclick: go(() => ctrl.setHome()) }, i18n('backToMenu')),
        ),
      ),
    );
    overlay.onclick = go(() => { vm.stageState = 'end'; });
    // the stage just ended: put focus on the overlay's first button (it is new on screen)
    if (!overlay.contains(document.activeElement)) requestAnimationFrame(() => overlay.querySelector<HTMLElement>('[data-autofocus]')?.focus({ preventScroll: true }));
  } else {
    overlay.hidden = true;
    overlay.onclick = null;
    overlay.replaceChildren();
  }

  // helping text on the board (lila lesson.ts renderInfo): clicking it continues
  const info = q('[data-info]');
  if (level.text && vm.levelState === 'play')
    info.replaceChildren(el('button', { type: 'button', class: 'learn__info', 'data-fid': 'info', onclick: go(() => ctrl.completeLevel()) }, rich(level.text)));
  else info.replaceChildren();

  // table: title, goal / result, level progress, tools (lila lesson.ts)
  let status: HTMLElement;
  if (vm.levelState === 'fail') {
    status = el('div', { class: 'result failed' },
      el('strong', {}, i18n('puzzleFailed')),
      el('button', { type: 'button', class: 'btn', 'data-fid': 'retry', onclick: go(() => ctrl.restartLevel()) }, i18n('retry')),
    );
  } else if (vm.levelState === 'completed') {
    status = el('div', { class: 'result completed' },
      el('strong', {}, congrats()),
      level.nextButton || vm.stageState === 'end'
        ? el('button', { type: 'button', class: 'btn primary', 'data-fid': 'next', onclick: go(() => ctrl.nextLesson()) }, i18n('next'))
        : stars(vm.score ?? 0),
    );
  } else {
    // USI destination is always characters 2-4 ("5f5e", "4d4c+", "S*5e"), same test as ground.ts createDrawable.
    const left = (level.obstacles ?? []).filter((o) => !vm.usiCList.some((uc) => uc.usi.slice(2, 4) === o)).length;
    const pieceSwitch = stage.key === 'introduction' && level.id === 1;
    status = el('div', { class: 'goal' },
      el('p', {}, rich(level.goal)),
      pieceSwitch && pieceSetSwitch(),
      level.obstacles?.length
        ? el('p', { class: 'small counter' },
            i18nFormat('il_movesMade', vm.usiCList.filter((u) => u.color === level.color).length),
            ' · ',
            left === 1 ? i18n('il_starsLeftOne') : i18nFormat('il_starsLeft', left))
        : null,
    );
  }

  const prog = ctrl.progress.get(stage.key);
  q('[data-table]').replaceChildren(
    el('div', { class: 'wrap' },
      el('div', { class: 'title' },
        el('p', { class: 'eyebrow' }, `${vm.category.name} · ${i18nFormat('stageX', stage.id)}`),
        el('h1', { tabindex: '-1', 'data-autofocus': !starting }, stage.title),
        el('p', { class: 'subtitle' }, rich(stage.subtitle)),
      ),
      el('div', { class: 'status', role: 'status' }, status),
      el('div', { class: 'levels' },
        el('p', { class: 'small lvl' }, i18nFormat('il_levelXofY', level.id, stage.levels.length)),
        el('ol', { class: 'progress', 'aria-label': i18n('il_levels') },
          ...stage.levels.map((l) => {
            const score = prog[l.id - 1];
            const state = l.id === level.id ? 'active' : score ? 'done' : 'future';
            return el('li', {},
              el('button', {
                type: 'button', class: state, 'data-fid': `lvl-${l.id}`,
                'aria-current': l.id === level.id ? 'step' : undefined,
                'aria-label': `${i18n('il_level')} ${l.id}${score ? `, ${i18nFormat('il_starsXofThree', score)}` : ''}`,
                onclick: go(() => ctrl.setLesson(stage.id, l.id)),
              }, score ? stars(score, false) : el('span', { class: 'id' }, String(l.id))),
            );
          }),
        ),
      ),
      el('div', { class: 'tools' },
        el('button', { type: 'button', class: 'tool', 'data-fid': 'restart', onclick: go(() => ctrl.restartLevel()) },
          icon('restart'), el('span', {}, i18n('il_restart'))),
        el('button', { type: 'button', class: 'tool', 'data-fid': 'settings', 'aria-haspopup': 'dialog', onclick: (e: Event) => { e.preventDefault(); openSettings(); } },
          icon('cog'), el('span', {}, i18n('il_settings'))),
      ),
    ),
  );
}

export function pieceSetSwitch(): HTMLElement {
  const kanji = document.documentElement.dataset.pieces === 'kanji';
  return el('div', { class: 'seg', role: 'group', 'aria-label': i18n('il_pieceSet') },
    el('button', { type: 'button', 'data-pieces-set': 'letters', 'aria-pressed': String(!kanji) }, i18n('il_letters')),
    el('button', { type: 'button', 'data-pieces-set': 'kanji', 'aria-pressed': String(kanji) }, i18n('il_kanji')),
  );
}

const icons: Record<string, string> = {
  // Simple strokes drawn for this site.
  restart: '<path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4.5h4.5"/>',
  cog: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
};
export function icon(name: string): HTMLElement {
  const s = el('span', { class: 'icon', 'aria-hidden': 'true' });
  s.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${icons[name]}</svg>`;
  return s;
}
