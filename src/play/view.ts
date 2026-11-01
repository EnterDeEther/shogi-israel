// AGPL-3.0-or-later, like the rest of this site.
import { el, icon, nextInCourse, pieceSetSwitch } from '../learn/view';
import { shareButton } from '../lib/share-card';
import { tipEl } from '../lib/info-tip-dom';
import type { TipId } from '../lib/info-tips';
import { copyText, downloadKif, kifFileName, LISHOGI_IMPORT_URL } from '../lib/kif';
import type PlayCtrl from './ctrl';
import type { PlaySettings } from './ctrl';
import type { GameEnd } from './game';
import { engineLabel, getLevel, levels } from './levels';
import { highestBeaten } from './record';
import { recordKif } from './record-kif';
import { scrollWithin } from '../lib/scroll-within';

const SIDE: Record<Color, string> = { sente: 'פותח', gote: 'משיב' };
const MARK: Record<Color, string> = { sente: '☗', gote: '☖' };

const levelHint: Record<number, string> = {
  1: 'למי שרק למד את החוקים. המחשב טועה הרבה.',
  2: 'עדיין סלחני, אבל כבר לוכד כלים שמשאירים לו.',
  3: 'שומר על הכלים שלו ומנצל טעויות גדולות.',
  4: 'יריב של ממש למתחילים.',
  5: 'מכאן משחק YaneuraOu, מנוע חזק בהרבה, וחושב שני מהלכים קדימה.',
  6: 'רואה קומבינציות קצרות. צריך לשחק בזהירות.',
  7: 'חזק. מתאים לשחקנים עם ניסיון.',
  8: 'חזק מאוד.',
  9: 'חזק מכמעט כל שחקן חובב.',
  10: 'הרמה החזקה ביותר שלנו.',
};

const CLOCKS: { label: string; value: PlaySettings['clock'] }[] = [
  { label: 'ללא שעון', value: null },
  { label: '5 דק׳ + 10 שנ׳', value: { limit: 300, byoyomi: 10 } },
  { label: '10 דק׳ + 30 שנ׳', value: { limit: 600, byoyomi: 30 } },
  { label: '30 דק׳ + 60 שנ׳', value: { limit: 1800, byoyomi: 60 } },
];

const extraIcons: Record<string, string> = {
  flip: '<path d="M7 4v16M7 4L3.5 7.5M7 4l3.5 3.5M17 20V4M17 20l-3.5-3.5M17 20l3.5-3.5"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  'end-left': '<path d="M18 6l-6 6 6 6M8 6v12"/>',
  'chev-left': '<path d="M15 6l-6 6 6 6"/>',
  'chev-right': '<path d="M9 6l6 6-6 6"/>',
  'end-right': '<path d="M6 6l6 6-6 6M16 6v12"/>',
  crown: '<path d="M4 18h16M5 16l-1-9 5 4 3-6 3 6 5-4-1 9z"/>',
};
function picon(name: string): HTMLElement {
  if (!extraIcons[name]) return icon(name);
  const s = el('span', { class: 'icon', 'aria-hidden': 'true' });
  s.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${extraIcons[name]}</svg>`;
  return s;
}

export function mount(root: HTMLElement): { board: HTMLElement } {
  root.classList.add('play');
  root.replaceChildren(
    el('div', { class: 'play__main' },
      el('div', {
        class: 'play__board', dir: 'ltr', tabindex: '0', role: 'application',
        'aria-roledescription': 'לוח שוגי', 'aria-label': 'הלוח', 'aria-describedby': 'play-kbd-help', 'data-board': true,
      },
        el('div', { class: 'play__sgbox' },
          el('div', { class: 'play__sg', 'data-sg': true }),
          el('div', { class: 'kbd-cursor', 'aria-hidden': 'true', 'data-cursor': true }),
          el('div', { class: 'play__overlay', 'data-overlay': true, hidden: true }),
        ),
      ),
      el('p', { class: 'sr-only', id: 'play-kbd-help' }, 'משחק במקלדת: חצים להזזת הסמן, Enter לבחירה ולמהלך, D לכלי מהיד, סימן שאלה לעזרה.'),
      el('div', { class: 'sr-only', 'aria-live': 'polite', 'data-live': true }),
    ),
    el('div', { class: 'play__table', 'data-table': true }),
  );
  return { board: root.querySelector<HTMLElement>('[data-sg]')! };
}

const fmt = (ms: number): string => {
  const s = Math.ceil(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
};

export function clockText(ctrl: PlayCtrl, color: Color): string {
  if (!ctrl.clock) return '';
  const t = ctrl.timeLeft(color);
  return t.main > 0 ? fmt(t.main) : `${fmt(t.byo)}`;
}

function endText(ctrl: PlayCtrl, end: GameEnd): { title: string; text: string } {
  const won = end.winner === ctrl.playerColor;
  const draw = !end.winner;
  const title = draw ? 'תיקו' : won ? 'ניצחת!' : 'המחשב ניצח';
  const text = {
    mate: won ? 'מט. המלך של המחשב לא יכול לברוח.' : 'מט. המלך שלך לא יכול לברוח.',
    stalemate: won ? 'למחשב לא נשאר אף מהלך חוקי, ובשוגי זה הפסד.' : 'לא נשאר לך אף מהלך חוקי, ובשוגי זה הפסד.',
    resign: won ? 'המחשב נכנע.' : 'נכנעת.',
    time: won ? 'הזמן של המחשב נגמר (טיימאאוט).' : 'הזמן שלך נגמר (טיימאאוט).',
    repetition: 'אותה עמדה חזרה ארבע פעמים (חזרה מרובעת).',
    perpetual: won ? 'המחשב נתן שח נצחי, ומי שנותן שח נצחי מפסיד.' : 'נתת שח נצחי, ומי שנותן שח נצחי מפסיד.',
    impasse: won ? 'הכרזת על ניצחון בנקודות (מבוי סתום).' : 'המחשב הכריז על ניצחון בנקודות (מבוי סתום).',
    draw: 'לאף צד לא נשארו מספיק כלים.',
  }[end.reason];
  return { title, text };
}

function playerRow(ctrl: PlayCtrl, color: Color): HTMLElement {
  const isAi = color === ctrl.aiColor;
  const level = ctrl.level;
  const running = ctrl.clock?.running === color;
  const t = ctrl.clock ? ctrl.timeLeft(color) : undefined;
  return el('div', { class: `ruser${isAi ? ' ai' : ' me'}${running ? ' running' : ''}` },
    el('span', { class: 'mark', 'aria-hidden': 'true' }, MARK[color]),
    el('span', { class: 'who' },
      el('strong', {}, isAi ? `המחשב · רמה ${level.level}` : '⟦אתה|את⟧'),
      el('span', { class: 'small muted' }, isAi ? `${SIDE[color]} · ${engineLabel[level.engine]}` : SIDE[color]),
    ),
    ctrl.clock
      ? el('span', {
        class: `rclock${t && t.main <= 0 ? ' byo' : ''}`, dir: 'ltr', 'data-clock': color,
        'aria-label': `${isAi ? 'השעון של המחשב' : 'השעון שלך'}`,
      }, clockText(ctrl, color))
      : null,
  );
}

function moveList(ctrl: PlayCtrl, go: (fn: () => void) => (e: Event) => void): HTMLElement {
  const plies = ctrl.line.plies;
  const current = ctrl.viewPly ?? plies.length;
  const list = el('ol', { class: 'moves', 'aria-label': 'המהלכים' });
  plies.forEach((p, i) => {
    list.append(el('li', {},
      el('button', {
        type: 'button', class: `mv${i + 1 === current ? ' active' : ''}`, 'data-ply': String(i + 1),
        'aria-current': i + 1 === current ? 'step' : undefined,
        onclick: go(() => ctrl.view(i + 1)),
      },
        el('span', { class: 'n' }, String(i + 1)),
        el('span', { class: 'mark', 'aria-hidden': 'true' }, MARK[p.color]),
        el('bdi', { dir: 'ltr' }, p.western),
      )));
  });
  const box = el('div', { class: 'moves-box', 'data-moves': true });
  if (!plies.length) box.append(el('p', { class: 'small muted empty' }, ctrl.record ? 'עוד לא שוחקו מהלכים.' : ''));
  else box.append(list);
  return box;
}

function navButtons(ctrl: PlayCtrl, go: (fn: () => void) => (e: Event) => void): HTMLElement {
  const n = ctrl.line.plies.length;
  const cur = ctrl.viewPly ?? n;
  const b = (name: string, label: string, fn: () => void, disabled: boolean) =>
    el('button', { type: 'button', class: 'nav', 'aria-label': label, title: label, 'data-fid': `nav-${name}`, disabled, onclick: go(fn) }, picon(name));
  return el('div', { class: 'replay-nav', role: 'group', 'aria-label': 'מעבר בין המהלכים' },
    b('end-right', 'להתחלה', () => ctrl.view(0), cur === 0),
    b('chev-right', 'מהלך אחורה', () => ctrl.step(-1), cur === 0),
    b('chev-left', 'מהלך קדימה', () => ctrl.step(1), cur === n),
    b('end-left', 'לעמדה הנוכחית', () => ctrl.view(undefined), cur === n),
  );
}

function controls(ctrl: PlayCtrl, go: (fn: () => void) => (e: Event) => void, openSettings: () => void): HTMLElement {
  const tool = (name: string, label: string, fn: () => void, opts: { disabled?: boolean; cls?: string; iconName?: string } = {}) =>
    el('button', { type: 'button', class: `tool${opts.cls ? ` ${opts.cls}` : ''}`, 'data-fid': `tool-${name}`, title: label, disabled: !!opts.disabled, onclick: go(fn) },
      picon(opts.iconName ?? name), el('span', { class: 'label' }, label));
  if (ctrl.resignConfirm) {
    return el('div', { class: 'tools confirm', role: 'group', 'aria-label': 'אישור כניעה' },
      el('span', { class: 'q' }, 'להיכנע?'),
      tool('flag', 'כן, נכנעים', () => ctrl.resign(), { cls: 'danger' }),
      tool('close', 'לא, ממשיכים', () => ctrl.cancelResign()),
    );
  }
  return el('div', { class: 'tools', role: 'group', 'aria-label': 'פעולות במשחק' },
    tool('undo', 'החזרת מהלך', () => ctrl.takeback(), { disabled: !ctrl.takebackPlies }),
    tool('flip', 'הפיכת הלוח', () => ctrl.flip()),
    tool('flag', 'כניעה', () => ctrl.resign(), { disabled: !ctrl.playing }),
    tool('plus', 'משחק חדש', () => ctrl.openSetup()),
    tool('cog', 'הגדרות', openSettings),
  );
}

const kifText = (ctrl: PlayCtrl): string => recordKif(ctrl.record!);

function kifButtons(ctrl: PlayCtrl): HTMLElement {
  const flash = (btn: HTMLElement, text: string) => {
    const before = btn.textContent;
    btn.textContent = text;
    window.setTimeout(() => (btn.textContent = before), 2000);
  };
  const b = (label: string, fn: (btn: HTMLElement) => void) => {
    const btn = el('button', { type: 'button', class: 'link' }, label);
    btn.addEventListener('click', (e) => { e.preventDefault(); fn(btn); });
    return btn;
  };
  return el('div', { class: 'kif-export', 'data-hook': 'export' },
    el('span', { class: 'small' }, 'רישום המשחק (KIF):', tipEl('kif')),
    b('הורדה', () => downloadKif(kifText(ctrl), kifFileName({ date: new Date(ctrl.record!.startedAt) }))),
    b('העתקה', async (btn) => flash(btn, (await copyText(kifText(ctrl))) ? 'הועתק ✓' : 'ההעתקה נכשלה')),
    b('ניתוח ב־Lishogi', async (btn) => {
      const ok = await copyText(kifText(ctrl));
      flash(btn, ok ? 'הועתק, ⟦הדבק|הדביקי⟧ בחלון שנפתח' : 'ההעתקה נכשלה');
      window.open(LISHOGI_IMPORT_URL, '_blank', 'noopener');
    }),
  );
}

function status(ctrl: PlayCtrl, go: (fn: () => void) => (e: Event) => void): HTMLElement | null {
  if (!ctrl.record) return null;
  const end = ctrl.ended;
  if (end) {
    const { title, text } = endText(ctrl, end);
    const won = end.winner === ctrl.playerColor;
    const next = ctrl.level.level < 10 && won;
    return el('div', { class: `result ${end.winner ? (won ? 'won' : 'lost') : 'draw'}`, role: 'status' },
      el('strong', {}, title),
      el('p', {}, text),
      ctrl.record.takebacks ? el('p', { class: 'small muted' }, `החזרת ${ctrl.record.takebacks === 1 ? 'מהלך אחד' : `${ctrl.record.takebacks} מהלכים`} במשחק הזה.`) : null,
      el('div', { class: 'buttons' },
        next
          ? el('button', { type: 'button', class: 'btn primary', 'data-fid': 'next-level', onclick: go(() => ctrl.newGame({ ...ctrl.settings, level: ctrl.level.level + 1 })) }, `לרמה ${ctrl.level.level + 1}`)
          : null,
        el('button', { type: 'button', class: `btn${next ? '' : ' primary'}`, 'data-fid': 'again', onclick: go(() => ctrl.newGame(ctrl.settings)) }, 'משחק נוסף'),
        el('button', { type: 'button', class: 'link', onclick: go(() => ctrl.openSetup()) }, 'הגדרות משחק'),
      ),
      kifButtons(ctrl),
      el('p', { class: 'small', 'data-signed-out-only': '' },
        won ? 'כל הכבוד! ' : '', el('a', { href: '/account/?mode=signup' }, '⟦פתח|פתחי⟧ חשבון בחינם'), ' כדי לשמור את המשחקים שלך ולהתקדם במסלול, בכל מכשיר.'),
      won ? shareButton({ title: `ניצחתי את המחשב ברמה ${ctrl.level.level}`, sub: 'שוגי, השחמט היפני. משחקים בעברית ובחינם', kanji: '勝', path: '/play/' }, 'shogi-israel-win.png', 'btn share') : null,
      nextInCourse(),
    );
  }
  if (ctrl.engineError) {
    return el('div', { class: 'status-line error', role: 'alert' },
      el('span', {}, 'המחשב לא הצליח לענות.'),
      el('button', { type: 'button', class: 'link', onclick: go(() => ctrl.retry()) }, 'לנסות שוב'),
    );
  }
  const pos = ctrl.line.current;
  const text = ctrl.thinking
    ? 'המחשב חושב…'
    : pos.turn === ctrl.playerColor
      ? pos.isCheck() ? 'שח! תורך.' : 'תורך.'
      : '';
  return el('div', { class: `status-line${ctrl.thinking ? ' thinking' : ''}`, 'aria-live': 'polite' },
    text,
    ctrl.canDeclareImpasse
      ? el('button', { type: 'button', class: 'btn', 'data-fid': 'impasse', onclick: go(() => ctrl.declareImpasse()) }, picon('crown'), ' הכרזת ניצחון בנקודות')
      : null,
    !ctrl.live ? el('button', { type: 'button', class: 'link', onclick: go(() => ctrl.view(undefined)) }, 'חזרה לעמדה הנוכחית') : null,
  );
}

function setupScreen(ctrl: PlayCtrl, draft: PlaySettings, go: (fn: () => void) => (e: Event) => void, rerender: () => void): HTMLElement {
  const beaten = highestBeaten();
  const lv = getLevel(draft.level);
  const seg = <T>(label: string, options: { label: string; value: T; sub?: string }[], cur: T, pick: (v: T) => void, cls = '', tip?: TipId) =>
    el('fieldset', { class: `setup-field ${cls}` },
      el('legend', {}, label, tip ? tipEl(tip) : null),
      el('div', { class: 'choices' }, ...options.map((o) => el('button', {
        type: 'button', class: 'choice', 'aria-pressed': String(JSON.stringify(o.value) === JSON.stringify(cur)),
        onclick: (e: Event) => { e.preventDefault(); pick(o.value); rerender(); },
      }, o.label, o.sub ? el('span', { class: 'sub' }, o.sub) : null))),
    );
  return el('div', { class: 'screen setup', role: 'dialog', 'aria-modal': 'false', 'aria-labelledby': 'play-setup-title' },
    el('h2', { id: 'play-setup-title' }, 'משחק נגד המחשב'),
    seg('רמה', levels.map((l) => ({ label: String(l.level), value: l.level })), draft.level, (v) => {
      draft.level = v;
      ctrl.preload(v);
    }, 'levels'),
    el('p', { class: 'level-hint' },
      el('strong', {}, `רמה ${lv.level}: `), levelHint[lv.level],
      beaten ? el('span', { class: 'small muted beaten' }, ` · הרמה הגבוהה שניצחת: ${beaten}`) : null),
    seg<PlaySettings['color']>('⟦אתה|את⟧ ⟦משחק|משחקת⟧', [
      { label: 'פותח', value: 'sente', sub: '⟦אתה|את⟧ ⟦מתחיל|מתחילה⟧' },
      { label: 'אקראי', value: 'random' },
      { label: 'משיב', value: 'gote', sub: 'המחשב מתחיל' },
    ], draft.color, (v) => (draft.color = v), '', 'sides'),
    seg('שעון', CLOCKS.map((c) => ({ label: c.label, value: c.value })), draft.clock, (v) => (draft.clock = v), 'clocks'),
    clockHelp(),
    el('div', { class: 'buttons' },
      el('button', { type: 'button', class: 'btn primary big', 'data-autofocus': true, 'data-fid': 'start', onclick: go(() => ctrl.newGame({ ...draft })) }, 'מתחילים'),
      ctrl.record ? el('button', { type: 'button', class: 'link', onclick: go(() => ctrl.closeSetup()) }, ctrl.playing ? 'חזרה למשחק' : 'סגירה') : null,
    ),
    ctrl.playing ? el('p', { class: 'small muted' }, 'משחק חדש יחליף את המשחק הנוכחי.') : null,
  );
}

function copyLink(): HTMLElement {
  const btn = el('button', { type: 'button', class: 'btn' }, 'העתקת הקישור לדף');
  btn.addEventListener('click', () => {
    navigator.clipboard?.writeText(location.href).then(() => { btn.textContent = 'הקישור הועתק. ⟦הדבק|הדביקי⟧ אותו בדפדפן'; }, () => {});
  });
  return btn;
}

function unsupported(reason: 'isolation' | 'wasm'): HTMLElement {
  return el('div', { class: 'screen' },
    el('h2', {}, 'הדפדפן הזה לא מריץ את המחשב'),
    el('p', {}, reason === 'wasm'
      ? 'המחשב רץ אצלך בדפדפן ודורש דפדפן עדכני. ⟦נסה|נסי⟧ גרסה עדכנית של Chrome, Firefox, Edge או Safari.'
      : 'הדף נפתח בתוך אפליקציה שחוסמת את מה שהמחשב צריך. ⟦פתח|פתחי⟧ את הקישור בדפדפן הרגיל (Chrome או Safari).'),
    el('p', {}, 'בינתיים אפשר להתאמן כאן גם בדפדפן הזה: ',
      el('a', { href: '/learn/' }, 'שיעורים אינטראקטיביים'), ' או ', el('a', { href: '/tsume/' }, 'בעיות מט'), '.'),
    reason === 'isolation' ? copyLink() : null,
  );
}

export const CLOCK_INFO_URL = '/clock/';
let clockHelpOpen = false;

function clockHelp(): HTMLElement {
  const d = el('details', { class: 'clock-help', ...(clockHelpOpen ? { open: true } : {}) },
    el('summary', {}, 'איך משחק על זמן עובד?'),
    el('p', {},
      'לכל צד יש זמן ראשי. כשהוא נגמר מתחילה ', el('strong', {}, 'ספירת שניות'),
      ': כל מהלך צריך להיעשות בתוך מספר השניות שבחרת, והספירה מתחילה מחדש אחרי כל מהלך. מי שהספירה שלו מגיעה לאפס מפסיד (טיימאאוט). ',
      'השעון של כל צד רץ רק בתורו. למשל ', el('bdi', {}, '10 דק׳ + 30 שנ׳'), ': עשר דקות לכל המשחק, ואחריהן 30 שניות לכל מהלך.'),
    el('a', { href: CLOCK_INFO_URL }, 'ההסבר המלא על משחק על זמן'),
  );
  d.addEventListener('toggle', () => (clockHelpOpen = d.open));
  return d;
}

let draft: PlaySettings | undefined;

export function render(ctrl: PlayCtrl, root: HTMLElement, openSettings: () => void, support: 'ok' | 'isolation' | 'wasm'): void {
  const focusedId = (document.activeElement as HTMLElement | null)?.dataset?.fid;
  const go = (fn: () => void) => (e: Event) => { e.preventDefault(); e.stopPropagation(); fn(); };
  const q = <T extends HTMLElement = HTMLElement>(s: string) => root.querySelector<T>(s)!;

  const overlay = q('[data-overlay]');
  if (support !== 'ok') {
    overlay.hidden = false;
    overlay.replaceChildren(unsupported(support));
  } else if (ctrl.setupOpen) {
    draft ??= { ...ctrl.settings };
    const rerender = () => render(ctrl, root, openSettings, support);
    overlay.hidden = false;
    overlay.replaceChildren(setupScreen(ctrl, draft, go, rerender));
  } else {
    draft = undefined;
    overlay.hidden = true;
    overlay.replaceChildren();
  }
  const wasSetup = root.classList.contains('setup-open');
  root.classList.toggle('setup-open', !overlay.hidden);
  if (wasSetup && overlay.hidden) {
    const frame = q('.play__board');
    requestAnimationFrame(() => {
      if (frame.getBoundingClientRect().top < (document.querySelector('.site-header')?.clientHeight ?? 0)) frame.scrollIntoView({ block: 'start' });
    });
  }

  const top = ctrl.orientation === 'sente' ? 'gote' : 'sente';
  const bottom = ctrl.orientation;
  const table = q('[data-table]');
  const movesScroll = table.querySelector('[data-moves]')?.scrollTop;
  table.replaceChildren(
    el('div', { class: 'table-box' },
      playerRow(ctrl, top),
      el('div', { class: 'replay' }, moveList(ctrl, go), navButtons(ctrl, go)),
      status(ctrl, go),
      controls(ctrl, go, openSettings),
      playerRow(ctrl, bottom),
    ),
    el('div', { class: 'pieces-switch' }, pieceSetSwitch(), tipEl('pieces')),
  );
  const box = table.querySelector<HTMLElement>('[data-moves]');
  if (box) {
    const active = box.querySelector<HTMLElement>('.mv.active');
    if (ctrl.live || !active) box.scrollTop = box.scrollHeight;
    else if (movesScroll !== undefined) box.scrollTop = movesScroll;
    if (active) scrollWithin(box, active);
  }
  if (focusedId) root.querySelector<HTMLElement>(`[data-fid="${focusedId}"]`)?.focus({ preventScroll: true });
}
