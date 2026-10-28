// Shogi Israel: our view for the ported Learn controller (replaces lila's snabbdom views).
// Same screens and flow as lila's views: home.ts (stage map + progress + "what next"), lesson.ts
// (side map with the back button, board, table with title, goal and level progress), side.ts,
// overlays/starting.ts and overlays/completed.ts; plus our settings dialog (the cog wheel).
// Page is RTL; the board is LTR and never mirrors. Plain DOM, no snabbdom.
// AGPL-3.0-or-later, like the rest of src/learn/.
import { categories, nextStage } from './categories';
import type LearnCtrl from './ctrl';
import { i18n, i18nFormat } from './i18n';
import type { CourseLevel, Stage } from './interfaces';
import { ownMoves } from './level';
import { READ_MORE } from './read-more';
import { chessNote, hasChessText, isChessRoute, setRoute, stageText } from './route';
import { stageUrl } from './urls';
import { average } from './util';
import { courseNext } from '../lib/next-step';
import { currentPieceSet } from '../lib/piece-set';

// Same list and random pick as lila's views/congrats.ts
const congratsKeys = [
  'awesome', 'excellent', 'greatJob', 'perfect', 'outstanding',
  'wayToGo', 'yesYesYes', 'youreGoodAtThis', 'nailedIt', 'rightOn',
];
// Shogi Israel: the coach redraws often, so its word stays the same for a given level
const congratsFor = (seed: string) => i18n(congratsKeys[[...seed].reduce((a, c) => a + c.charCodeAt(0), 0) % congratsKeys.length]);
// Shogi Israel: the praise matches the stars ("מושלם!" with two stars read as a contradiction). Under three
// stars it says why (more moves than needed) and how to get all three.
const movesText = (n: number) => (n === 1 ? 'מהלך אחד' : `־${n} מהלכים`);
function praise(vm: NonNullable<LearnCtrl['vm']>, seed: string): { word: string; why: HTMLElement | null } {
  const { level, score = 0, usiCList } = vm;
  if (score >= 3) return { word: congratsFor(seed), why: null };
  return {
    word: i18n(score === 2 ? 'il_praiseTwo' : 'il_praiseOne'),
    why: el('p', { class: 'small score-why' }, i18nFormat('il_fewerMoves', movesText(ownMoves(level, usiCList)), movesText(level.nbMoves))),
  };
}

type Child = Node | string | null | undefined | false;
type Attrs = Record<string, string | boolean | undefined | ((e: Event) => void)>;
/** Shogi Israel: the next step of a signed-in visitor's course (src/lib/next-step.ts), for end screens. */
export function nextInCourse(): HTMLElement | null {
  const n = courseNext();
  return n ? el('p', { class: 'small next-in-course' }, 'הצעד הבא במסלול: ', el('a', { href: n.href }, n.title), ` (${n.kind})`) : null;
}

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

// Openings, castles and strategy are explained on /learn/guide/; the map and each stage's start screen link there.
const GUIDE: Record<string, { anchor: string; text: string }> = {
  openings: { anchor: 'opening', text: 'il_guideOpenings' },
  castles: { anchor: 'castle', text: 'il_guideCastles' },
  strategy: { anchor: 'strategy', text: 'il_guideStrategy' },
};

// The game phase a lesson belongs to (opening, middle game, endgame), shown as a chip that links to the explanation.
const PHASE_BY_CATEGORY: Record<string, string> = { openings: 'il_phaseOpening', castles: 'il_phaseCastles', strategy: 'il_phaseMiddle' };
const PHASE_BY_STAGE: Record<string, string> = { whatIf: 'il_phaseOpening', checkmate1: 'il_phaseEnd', value: 'il_phaseMiddle' };
const LEVEL_KEY: Record<CourseLevel, string> = { beginner: 'il_courseBeginner', intermediate: 'il_courseIntermediate', advanced: 'il_courseAdvanced' };
const phaseOf = (categoryKey: string, stageKey?: string): string | undefined => (stageKey && PHASE_BY_STAGE[stageKey]) || PHASE_BY_CATEGORY[categoryKey];
const phaseChip = (phase: string | undefined, stop = false) =>
  phase && el('p', { class: 'phase' }, el('a', { href: '/learn/guide/#phases', onclick: stop ? (e: Event) => e.stopPropagation() : undefined }, i18n(phase)));

/** Our strings use **bold** for a new term, and moves like P-76 must stay left-to-right. */
export function rich(text: string): DocumentFragment {
  const f = document.createDocumentFragment();
  text.split(/(\*\*[^*]+\*\*|\+?[KRBGSNLP](?:\d\d)?[-x*]\d\d\+?)/).forEach((part, i) => {
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
  staticRook: '居', rangingRook: '振',
  fourthFileRook: '四', centralRook: '中', thirdFileRook: '三', yagura: '矢', bishopExchange: '角', ishida: '石',
  quickIshida: '罠', opposingRook: '向', doubleRangingRook: '相', sidePawn: '横', twistingRook: '捻',
  rangingCastles: '美', staticCastles: '舟', primitiveClimbingSilver: '棒', climbingSilverVsRanging: '急', sittingSilver: '腰',
  chainedSilver: '鎌', bishopClimbingSilver: '登', rapidSilver: '早', bishopSittingSilver: '掛', spearingSparrow: '雀', whatIf: '誤',
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
    el('div', { class: 'learn__coach', 'data-coach': true, hidden: true }),
    el('button', { type: 'button', class: 'learn__bubble', 'data-bubble': true, hidden: true }),
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
  q('[data-coach]').hidden = true;
  q('[data-bubble]').hidden = true;
  _root.classList.remove('has-coach');
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
    ...categories.flatMap((c, i) => [
      // The map is split into three course levels, each one starting with its own heading
      c.level !== categories[i - 1]?.level ? el('p', { class: 'course-level', id: `level-${c.level}` },
        el('span', {}, i18n('il_courseLevelNote')), i18n(LEVEL_KEY[c.level])) : null,
      el('section', { class: 'categ', 'aria-labelledby': `cat-${c.key}` },
        el('h2', { id: `cat-${c.key}` }, c.name),
        phaseChip(phaseOf(c.key)),
        GUIDE[c.key] && el('p', {}, el('a', { href: `/learn/guide/#${GUIDE[c.key].anchor}` }, i18n(GUIDE[c.key].text))),
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
    ]).filter((n): n is HTMLElement => !!n),
    el('section', { class: 'categ what-next', 'aria-labelledby': 'cat-next' },
      el('h2', { id: 'cat-next' }, i18n('whatNext')),
      el('p', {}, i18n('youKnowHowToPlayShogi')),
      el('div', { class: 'categ_stages' },
        ...whatNextLinks(_root.dataset).map(([href, seal, title, sub]) => whatNext(href, seal, i18n(title), i18n(sub))),
      ),
    ),
  );
}

/**
 * Shogi Israel: lila points every "what next" card at lishogi.org. Ours point to playing here first
 * (/play/, /account/) and keep Lishogi for public games and tournaments.
 * The island's data-has-* flags say which of our pages exist in this build; until one does, its Lishogi card stays.
 */
function whatNextLinks(has: DOMStringMap): [href: string, seal: string, title: string, subtitle: string][] {
  const on = (k: string) => has[k] !== undefined;
  return [
    ['/rules/', '書', 'il_rulesCourse', 'il_rulesCourseSub'],
    ...(on('hasTsume') ? [['/tsume/', '詰', 'il_tsume', 'il_tsumeSub'] as [string, string, string, string]] : []),
    on('hasPlay')
      ? ['/play/', '機', 'playMachine', 'il_playMachineHere']
      : ['https://lishogi.org/#ai', '機', 'playMachine', 'testYourSkillsWithTheComputer'],
    on('hasAccount')
      ? ['/account/?mode=signup', '登', 'register', 'il_getAShogiIsraelAccount']
      : ['https://lishogi.org/signup', '登', 'register', 'getAFreeLishogiAccount'],
    [on('hasLishogiGuide') ? '/lishogi/' : 'https://lishogi.org/team/---shogi-israel', '対', 'playPeople', 'il_opponentsOnLishogi'],
  ];
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
  // Phones only (CSS): the exercise's instructions sit under the board and in the tips bubble, out of sight at first.
  q('[data-back-narrow]').replaceChildren(backLink('back-narrow', 'back-narrow'),
    el('p', { class: 'learn__phone-hint' }, icon('bulb'), el('span', {}, rich(i18n('il_phoneHint')))));

  // overlays on the board (lila overlays/starting.ts, overlays/completed.ts)
  const overlay = q('[data-overlay]');
  const chess = (starting || completed) && isChessRoute();
  const note = starting && chessNote(stage.key, chess);
  if (starting) {
    overlay.hidden = false;
    overlay.className = 'learn__overlay starting';
    const start = go(() => { vm.stageState = 'running'; });
    overlay.replaceChildren(
      el('div', { class: 'screen', role: 'dialog', 'aria-labelledby': 'learn-ov-title' },
        stageImg(stage.key),
        el('p', { class: 'eyebrow' }, i18nFormat('stageX', stage.id)),
        el('h2', { id: 'learn-ov-title' }, stage.title),
        phaseChip(phaseOf(vm.category.key, stage.key), true),
        el('p', {}, rich(stageText(stage.key, 'Intro', stage.intro, chess))),
        note && el('p', { class: 'chess-note' }, rich(note)),
        // Chess route only: a way back to the plain explanation (the /chess/ page and the starting point turn the route on)
        chess && hasChessText(stage.key) && el('p', { class: 'small route-switch' },
          el('button', { type: 'button', class: 'linkish', 'data-fid': 'route-main', onclick: go(() => setRoute('main')) }, i18n('il_chessRouteOff'))),
        READ_MORE[stage.key] && el('p', { class: 'guide-link' }, el('a', { href: `/${READ_MORE[stage.key]}/`, onclick: (e: Event) => e.stopPropagation() }, i18n('il_b_readMore'))),
        GUIDE[vm.category.key] && el('p', { class: 'guide-link' }, el('a', { href: `/learn/guide/#${GUIDE[vm.category.key].anchor}`, onclick: (e: Event) => e.stopPropagation() }, i18n('il_guideRead'))),
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
        el('p', {}, rich(stageText(stage.key, 'Complete', stage.complete, chess))),
        el('div', { class: 'buttons' },
          next
            ? el('button', { type: 'button', class: 'btn primary', 'data-autofocus': true, 'data-fid': 'ov-next', onclick: go(() => ctrl.nextLesson()) },
                `${i18n('next')}: ${next.title}`)
            : el('a', { href: '/learn/', class: 'btn primary', 'data-autofocus': true, 'data-fid': 'ov-next', onclick: go(() => ctrl.setHome()) }, i18n('whatNext')),
          el('button', { type: 'button', class: 'btn', 'data-fid': 'ov-menu', onclick: go(() => ctrl.setHome()) }, i18n('backToMenu')),
        ),
        // Shogi Israel: the moment to offer an account (signed-out only; global.css hides it once signed in)
        root.dataset.hasAccount !== undefined
          ? el('p', { class: 'small', 'data-signed-out-only': '' }, el('a', { href: '/account/?mode=signup' }, i18n('il_saveStars')), ' ', i18n('il_saveStarsWhy'))
          : null,
        nextInCourse(),
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

  // Shogi Israel: the reason behind each move made so far (level.why), newest last
  const made = vm.usiCList.filter((u) => u.color === level.color).length;
  const whys = (level.why ?? []).slice(0, made);
  const whyList = whys.length
    ? el('div', { class: 'why' },
        el('p', { class: 'eyebrow' }, i18n('il_whyTitle')),
        el('ol', {}, ...whys.map((w, i) => el('li', { class: i === whys.length - 1 ? 'latest' : '' }, rich(w)))))
    : null;

  // table: title, goal / result, level progress, tools (lila lesson.ts)
  let status: HTMLElement;
  if (vm.levelState === 'fail') {
    status = el('div', { class: 'result failed' },
      el('strong', {}, i18n('puzzleFailed')),
      el('button', { type: 'button', class: 'btn', 'data-fid': 'retry', onclick: go(() => ctrl.retryMove()) }, i18n('retry')),
    );
  } else if (vm.levelState === 'completed') {
    const p = praise(vm, `${stage.key}${level.id}`);
    status = el('div', { class: 'result completed' },
      el('strong', {}, p.word),
      stars(vm.score ?? 0),
      p.why,
      el('button', { type: 'button', class: 'btn primary', 'data-fid': 'next', onclick: go(() => ctrl.nextLesson()) }, i18n('next')),
      whyList,
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
      whyList,
    );
  }

  renderCoach(ctrl, root, q, go);

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

// ---------- Shogi Israel: the coach (tips bubble + popup) ----------
// Every level keeps a list of tips: what we are about to do, why each move was played (lessons with level.why),
// a wrong move, and the recap at the end. The newest tip pops up beside the board on wide screens (over the
// table) and as a sheet under the board on phones, so the learner reads it while looking at the board. The
// arrows (or a swipe) step back through earlier tips. The floating bubble opens the popup again; the minimize
// button keeps it closed until the learner taps the bubble (new tips then show a dot on the bubble).
// Nothing moves on until the learner presses a button.
type TipKind = 'intro' | 'move' | 'reply' | 'fail' | 'done';
interface Tip { kind: TipKind; idx?: number }
const coach = { open: false, minimized: loadMinimized(), view: null as number | null, key: '', unread: false };
function loadMinimized(): boolean {
  try { return localStorage.getItem('learn-coach-min') === '1'; } catch { return false; }
}
function saveMinimized(v: boolean) {
  try { localStorage.setItem('learn-coach-min', v ? '1' : '0'); } catch { /* private mode: keep it for this visit only */ }
}
// Has the learner used the bubble yet? Until then it pulses, and the first tip explains how it works.
let knowsBubble = (() => { try { return localStorage.getItem('learn-coach-known') === '1'; } catch { return false; } })();
function learnedBubble() {
  knowsBubble = true;
  try { localStorage.setItem('learn-coach-known', '1'); } catch { /* fine */ }
}

/** The bubble can be dragged anywhere (finger or mouse); its place is kept as a share of the screen. */
function makeDraggable(bubble: HTMLElement) {
  if (bubble.dataset.drag) return;
  bubble.dataset.drag = '1';
  const place = (x: number, y: number) => {
    const w = bubble.offsetWidth, h = bubble.offsetHeight;
    const left = Math.min(Math.max(8, x), window.innerWidth - w - 8);
    const top = Math.min(Math.max(8, y), window.innerHeight - h - 8);
    Object.assign(bubble.style, { left: `${left}px`, top: `${top}px`, right: 'auto', bottom: 'auto' });
    return { left, top };
  };
  const restore = () => {
    try {
      const saved = JSON.parse(localStorage.getItem('learn-coach-pos') ?? 'null');
      if (saved) place(saved.x * window.innerWidth, saved.y * window.innerHeight);
    } catch { /* default corner */ }
  };
  requestAnimationFrame(restore);
  window.addEventListener('resize', restore);
  let start: { x: number; y: number; left: number; top: number } | null = null;
  bubble.addEventListener('pointerdown', (e) => {
    const r = bubble.getBoundingClientRect();
    start = { x: e.clientX, y: e.clientY, left: r.left, top: r.top };
    bubble.dataset.dragged = '';
    bubble.setPointerCapture(e.pointerId);
  });
  bubble.addEventListener('pointermove', (e) => {
    if (!start) return;
    const dx = e.clientX - start.x, dy = e.clientY - start.y;
    if (!bubble.dataset.dragged && Math.hypot(dx, dy) < 8) return;
    if (!bubble.dataset.dragged) { bubble.dataset.dragged = '1'; bubble.classList.add('dragging'); }
    place(start.left + dx, start.top + dy);
  });
  const end = () => {
    if (!start) return;
    start = null;
    bubble.classList.remove('dragging');
    if (bubble.dataset.dragged) {
      const r = bubble.getBoundingClientRect();
      try { localStorage.setItem('learn-coach-pos', JSON.stringify({ x: r.left / window.innerWidth, y: r.top / window.innerHeight })); } catch { /* fine */ }
      learnedBubble();
    }
  };
  bubble.addEventListener('pointerup', end);
  bubble.addEventListener('pointercancel', end);
  // a drag is not a tap
  bubble.addEventListener('click', (e) => { if (bubble.dataset.dragged) { e.stopImmediatePropagation(); e.preventDefault(); bubble.dataset.dragged = ''; } }, true);
}

function levelTips(ctrl: LearnCtrl): Tip[] {
  const vm = ctrl.vm!;
  const { level } = vm;
  const made = vm.usiCList.filter((u) => u.color === level.color).length;
  const failed = vm.levelState === 'fail';
  // the opponent's replies that follow the plan (a punishment after a wrong move is not one of them)
  const sc = level.scenario ?? [];
  let replied = 0;
  for (let i = 0; i < vm.usiCList.length && sc[i]?.usi === vm.usiCList[i].usi; i++) if (sc[i].color !== level.color) replied++;
  const tips: Tip[] = [{ kind: 'intro' }];
  if (level.why)
    for (let i = 0; i < (failed ? made - 1 : made); i++) {
      tips.push({ kind: 'move', idx: i });
      if (level.replies?.[i] && i < replied) tips.push({ kind: 'reply', idx: i });
    }
  if (failed) tips.push({ kind: 'fail', idx: made - 1 });
  if (vm.levelState === 'completed') {
    if (tips[tips.length - 1].kind === 'reply') tips.pop(); // the last reply is shown inside the summary
    tips.push({ kind: 'done' });
  }
  return tips;
}

function renderCoach(ctrl: LearnCtrl, root: HTMLElement, q: Q, go: Go) {
  const vm = ctrl.vm!;
  const { stage, level } = vm;
  const box = q('[data-coach]');
  const bubble = q('[data-bubble]');
  const off = vm.stageState === 'init' || vm.stageState === 'completed';
  ctrl.coachMinimized = coach.minimized;
  if (off) {
    box.hidden = true;
    bubble.hidden = true;
    root.classList.remove('has-coach');
    coach.key = '';
    return;
  }

  // a new tip: show it (unless the learner minimized the coach, or restarted a level whose intro they read)
  const tips = levelTips(ctrl);
  const current = tips.length - 1;
  const key = `${stage.key}#${level.id}:${tips.length}:${tips[current].kind}`;
  const fresh = key !== coach.key;
  if (fresh) {
    coach.key = key;
    coach.view = null;
    const quietIntro = tips[current].kind === 'intro' && vm.coach !== 'intro';
    if (coach.minimized) coach.unread = !quietIntro;
    else coach.open = !quietIntro;
  }
  const shown = coach.view ?? current;
  const tip = tips[shown];
  const isCurrent = shown === current;

  const setOpen = (open: boolean, minimize = false) => {
    coach.open = open;
    if (open) { coach.unread = false; coach.minimized = false; coach.view = null; saveMinimized(false); }
    if (minimize) { coach.minimized = true; saveMinimized(true); learnedBubble(); }
    ctrl.coachMinimized = coach.minimized;
    if (!open && vm.waiting) ctrl.continueAfterMove();
  };

  // the floating bubble: always there; a tap opens or minimizes the tips, a drag moves it
  makeDraggable(bubble);
  bubble.hidden = false;
  bubble.className = `learn__bubble${coach.unread ? ' unread' : ''}${coach.open ? ' open' : ''}${knowsBubble ? '' : ' new'}`;
  bubble.setAttribute('aria-expanded', String(coach.open));
  bubble.setAttribute('aria-label', coach.open ? i18n('il_coachMinimize') : i18n('il_coachBubble'));
  bubble.onclick = go(() => { learnedBubble(); setOpen(!coach.open, coach.open); });
  bubble.replaceChildren(icon('bulb'), el('span', { class: 'label' }, i18n('il_tips')), el('span', { class: 'dot', 'aria-hidden': 'true' }));

  root.classList.toggle('has-coach', coach.open);
  if (!coach.open) {
    box.hidden = true;
    return;
  }

  const made = vm.usiCList.filter((u) => u.color === level.color).length;
  const total = level.why?.length ?? 0;
  const name = (i?: number) => (i === undefined ? undefined : level.moveNames?.[i]);
  const reply = (i: number) => el('div', { class: 'reply' },
    el('p', { class: 'eyebrow' }, i18n('il_opponentPlayed'), ' ', el('bdi', { dir: 'ltr', class: 'mv' }, level.replyNames?.[i] ?? '')),
    el('p', {}, rich(level.replies![i])));
  const btn = (label: string, fn: () => void, primary = true, fid = 'coach-main') =>
    el('button', { type: 'button', class: `btn${primary ? ' primary' : ''}`, 'data-fid': fid, 'data-coach-focus': primary, onclick: go(fn) }, label);
  const last = level.id === stage.levels.length;

  let body: Child[] = [];
  if (tip.kind === 'intro') {
    body = [
      el('h2', {}, i18n('il_coachIntroTitle')),
      el('p', { class: 'lead' }, rich(level.goal)),
      total ? el('p', { class: 'hint' }, i18n(level.replies ? 'il_coachIntroWhyReplies' : 'il_coachIntroWhy')) : null,
      !knowsBubble && el('div', { class: 'how' }, icon('bulb'), el('p', {}, rich(i18n('il_coachHow')))),
      isCurrent && el('div', { class: 'buttons' }, btn(i18n('il_start'), () => setOpen(false))),
    ];
  } else if (tip.kind === 'move') {
    const i = tip.idx!;
    body = [
      el('h2', {}, el('span', { class: 'tick', 'aria-hidden': 'true' }, '✓'), ' ',
        name(i) ? el('bdi', { dir: 'ltr' }, name(i)!) : i18n('il_goodMove')),
      el('p', { class: 'lead' }, rich(level.why?.[i] ?? '')),
      total > 1 ? steps(i + 1, total) : null,
      isCurrent && el('div', { class: 'buttons' },
        btn(vm.waiting ? i18n('il_continueOpponent') : i18n('il_continue'), () => setOpen(false))),
    ];
  } else if (tip.kind === 'reply') {
    const i = tip.idx!;
    body = [
      el('h2', {}, i18n('il_opponentPlayed'), ' ', el('bdi', { dir: 'ltr' }, level.replyNames?.[i] ?? '')),
      el('p', { class: 'lead' }, rich(level.replies![i])),
      isCurrent && el('div', { class: 'buttons' }, btn(i18n('il_yourTurn'), () => setOpen(false))),
    ];
  } else if (tip.kind === 'done') {
    const lastIdx = (level.why?.length ?? 0) - 1;
    const lastReply = level.replies?.[lastIdx] && vm.usiCList.length === level.scenario?.length && vm.usiCList[vm.usiCList.length - 1].color !== level.color;
    const recap = level.why && level.moveNames
      ? el('div', { class: 'recap' },
          el('p', { class: 'eyebrow' }, i18n('il_recapTitle')),
          el('ol', {}, ...level.why.map((w, i) => el('li', {}, el('bdi', { dir: 'ltr', class: 'mv' }, level.moveNames![i]), ' ', rich(w),
            level.replies?.[i] && level.replyNames?.[i] && i < lastIdx
              ? el('span', { class: 'rep' }, ' ', el('bdi', { dir: 'ltr', class: 'mv opp' }, level.replyNames[i]), ' ', rich(level.replies[i]))
              : null))))
      : level.recap
        ? el('div', { class: 'recap' }, el('p', { class: 'eyebrow' }, i18n('il_recapTitle')), el('p', { class: 'lead' }, rich(level.recap)))
        : el('p', { class: 'lead' }, el('span', { class: 'muted' }, i18n('il_doneWith')), ' ', rich(level.goal.replace(/ המהלכים.*$/, '')));
    const p = praise(vm, `${stage.key}${level.id}`);
    body = [
      lastReply ? reply(lastIdx) : null,
      el('h2', {}, p.word, ' ', stars(vm.score ?? 0)),
      p.why,
      recap,
      el('div', { class: 'buttons' },
        btn(last ? i18n('il_finishStage') : i18n('il_nextLevel'), () => ctrl.nextLesson()),
        btn(i18n('il_again'), () => ctrl.restartLevel(), false, 'coach-again')),
    ];
  } else {
    const expected = level.scenario && name(tip.idx);
    body = [
      el('h2', { class: 'bad' }, i18n('il_wrongTitle')),
      el('p', { class: 'lead' }, expected ? rich(i18nFormat('il_wrongPlan', expected)) : i18n('il_wrongTry')),
      isCurrent && el('div', { class: 'buttons' }, btn(i18n('il_tryAgain'), () => ctrl.retryMove())),
    ];
  }

  // older / newer: RTL, so the older tip is on the right
  const goTo = (i: number) => go(() => { coach.view = i >= current ? null : Math.max(0, i); });
  const nav = tips.length > 1
    ? el('div', { class: 'coach-nav' },
        el('button', { type: 'button', class: 'arrow', 'data-fid': 'coach-older', 'aria-label': i18n('il_tipOlder'), disabled: shown === 0, onclick: goTo(shown - 1) }, '→'),
        el('span', { class: 'count' }, el('bdi', { dir: 'ltr' }, `${shown + 1} / ${tips.length}`)),
        el('button', { type: 'button', class: 'arrow', 'data-fid': 'coach-newer', 'aria-label': i18n('il_tipNewer'), disabled: isCurrent, onclick: goTo(shown + 1) }, '←'),
      )
    : null;

  const head = el('div', { class: 'coach-head' },
    el('p', { class: 'eyebrow' }, i18nFormat('il_levelXofY', level.id, stage.levels.length)),
    el('button', { type: 'button', class: 'coach-min', 'aria-label': i18n('il_coachMinimize'), 'data-fid': 'coach-min',
      onclick: go(() => setOpen(false, true)) }, icon('minimize')));
  const card = el('div', { class: `coach-card${isCurrent ? '' : ' older'}` }, head, ...body, nav);
  let x0: number | null = null;
  card.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
  card.addEventListener('touchend', (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    x0 = null;
    if (Math.abs(dx) < 50) return;
    const to = dx > 0 ? shown - 1 : shown + 1; // swipe right shows the older tip (RTL)
    if (to >= 0 && to <= current) { coach.view = to >= current ? null : to; ctrl.redraw(); }
  });

  box.hidden = false;
  box.className = `learn__coach coach-${tip.kind}`;
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'false');
  box.setAttribute('aria-label', i18n(`il_coach_${tip.kind}`));
  box.replaceChildren(card);

  // a new tip: bring the board and the popup into view together, and move focus to its button
  if (fresh) {
    requestAnimationFrame(() => {
      const board = root.querySelector<HTMLElement>('[data-board]')!.getBoundingClientRect();
      const sheet = box.getBoundingClientRect();
      const narrow = getComputedStyle(box).position === 'fixed';
      if (narrow && (board.top < 48 || board.bottom > sheet.top)) window.scrollBy({ top: board.top - 56, behavior: 'smooth' });
      if (tip.kind !== 'intro') box.querySelector<HTMLElement>('[data-coach-focus]')?.focus({ preventScroll: true });
    });
  }
}

function steps(made: number, total: number): HTMLElement {
  return el('div', { class: 'steps', 'aria-label': i18nFormat('il_moveXofY', made, total) },
    ...Array.from({ length: total }, (_, i) => el('span', { class: i < made ? 'on' : '', 'aria-hidden': 'true' })));
}

export function pieceSetSwitch(): HTMLElement {
  const set = currentPieceSet();
  return el('div', { class: 'seg', role: 'group', 'aria-label': i18n('il_pieceSet') },
    el('button', { type: 'button', 'data-pieces-set': 'hebrew', 'aria-pressed': String(set === 'hebrew') }, i18n('il_hebrew')),
    el('button', { type: 'button', 'data-pieces-set': 'letters', 'aria-pressed': String(set === 'letters') }, i18n('il_letters')),
    el('button', { type: 'button', 'data-pieces-set': 'kanji', 'aria-pressed': String(set === 'kanji') }, i18n('il_kanji')),
  );
}

const icons: Record<string, string> = {
  // Simple strokes drawn for this site.
  restart: '<path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4.5h4.5"/>',
  cog: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  minimize: '<path d="M6 12h12"/>',
  bulb: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3z"/>',
};
export function icon(name: string): HTMLElement {
  const s = el('span', { class: 'icon', 'aria-hidden': 'true' });
  s.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${icons[name]}</svg>`;
  return s;
}
