// AGPL-3.0-or-later, like the rest of this site.
import { el, icon, pieceSetSwitch } from '../learn/view';
import { localMove } from '../lib/move-notation';
import { copyText, downloadKif, kifFileName, LISHOGI_IMPORT_URL } from '../lib/kif';
import { scrollWithin } from '../lib/scroll-within';
import { tipEl } from '../lib/info-tip-dom';
import { gameUrl, SIGNAL_TEXT, SPEED_TEXT } from './client';
import { SIGNALS, type EndReason } from './core';
import type FriendCtrl from './ctrl';

const MARK: Record<Color, string> = { sente: '☗', gote: '☖' };
const SIDE: Record<Color, string> = { sente: 'פותח', gote: 'משיב' };
type Go = (fn: () => void) => (e: Event) => void;

const extraIcons: Record<string, string> = {
  flip: '<path d="M7 4v16M7 4L3.5 7.5M7 4l3.5 3.5M17 20V4M17 20l-3.5-3.5M17 20l3.5-3.5"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/>',
  shield: '<path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z"/>',
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

const fmt = (ms: number): string => {
  const s = Math.ceil(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
};

export function clockText(ctrl: FriendCtrl, color: Color): string {
  if (!ctrl.game?.clock) return '';
  const t = ctrl.timeLeft(color);
  return t.main > 0 ? fmt(t.main) : fmt(t.byo);
}

export function hoursText(ms: number): string {
  const h = Math.floor(ms / 3600000);
  if (h >= 2) return `${h} שעות`;
  if (h === 1) return 'שעה';
  const m = Math.max(1, Math.ceil(ms / 60000));
  return m === 1 ? 'דקה' : `${m} דקות`;
}

export function endText(reason: EndReason, won: boolean, draw: boolean, opp: string): { title: string; text: string } {
  if (reason === 'abort') return { title: 'המשחק בוטל', text: 'המשחק בוטל לפני ששני הצדדים שיחקו מהלך, ולא נרשמה תוצאה.' };
  const title = draw ? 'תיקו' : won ? 'ניצחת!' : 'הפסד הפעם';
  const text: Record<Exclude<EndReason, 'abort'>, string> = {
    mate: won ? `מט. למלך של ${opp} אין לאן לברוח.` : 'מט. למלך שלך אין לאן לברוח.',
    stalemate: won ? `ל${opp} לא נשאר אף מהלך חוקי, ובשוגי זה הפסד.` : 'לא נשאר לך אף מהלך חוקי, ובשוגי זה הפסד.',
    resign: won ? 'ניצחון בכניעה.' : 'נכנעת.',
    time: won ? `הזמן של ${opp} נגמר (טיימאאוט).` : 'הזמן שלך נגמר (טיימאאוט).',
    repetition: 'אותה עמדה חזרה ארבע פעמים (חזרה מרובעת).',
    perpetual: won ? `שח נצחי של ${opp}, ומי שנותן שח נצחי מפסיד.` : 'נתת שח נצחי, ומי שנותן שח נצחי מפסיד.',
    impasse: won ? 'הכרזת על ניצחון בנקודות (מבוי סתום).' : `הכרזה של ${opp} על ניצחון בנקודות (מבוי סתום).`,
    draw: 'לאף צד לא נשארו מספיק כלים.',
    agreement: 'תיקו בהסכמה.',
  };
  return { title, text: text[reason] };
}

function playerRow(ctrl: FriendCtrl, color: Color): HTMLElement {
  const g = ctrl.game!;
  const me = color === g.you;
  const running = g.clock?.running === color && ctrl.active;
  const t = g.clock ? ctrl.timeLeft(color) : undefined;
  const turn = ctrl.active && ctrl.line.current.turn === color;
  return el('div', { class: `ruser${me ? ' me' : ' ai'}${running ? ' running' : ''}${turn ? ' turn' : ''}` },
    el('span', { class: 'mark', 'aria-hidden': 'true' }, MARK[color]),
    el('span', { class: 'who' },
      el('strong', {}, me ? '⟦אתה|את⟧' : g.names[color]),
      el('span', { class: 'small muted' }, me ? `${SIDE[color]} · ${g.names[color]}` : `${SIDE[color]}${g.guest[color] ? ' · משחק כאורח' : ''}`),
    ),
    g.clock
      ? el('span', { class: `rclock${t && t.main <= 0 ? ' byo' : ''}`, dir: 'ltr', 'data-clock': color, 'aria-label': me ? 'השעון שלך' : `השעון של ${g.names[color]}` }, clockText(ctrl, color))
      : null,
  );
}

function moveList(ctrl: FriendCtrl, go: Go): HTMLElement {
  const plies = ctrl.line.plies;
  const current = ctrl.viewPly ?? plies.length;
  const box = el('div', { class: 'moves-box', 'data-moves': true });
  if (!plies.length) {
    box.append(el('p', { class: 'small muted empty' }, 'עוד לא שוחקו מהלכים.'));
    return box;
  }
  box.append(el('ol', { class: 'moves', 'aria-label': 'המהלכים' }, ...plies.map((p, i) => el('li', {},
    el('button', {
      type: 'button', class: `mv${i + 1 === current ? ' active' : ''}`, 'aria-current': i + 1 === current ? 'step' : undefined,
      onclick: go(() => ctrl.view(i + 1)),
    }, el('span', { class: 'n' }, String(i + 1)), el('span', { class: 'mark', 'aria-hidden': 'true' }, MARK[p.color]), el('bdi', { dir: 'ltr' }, localMove(p.western)))))));
  return box;
}

function navButtons(ctrl: FriendCtrl, go: Go): HTMLElement {
  const n = ctrl.line.plies.length;
  const cur = ctrl.viewPly ?? n;
  const b = (name: string, label: string, fn: () => void, disabled: boolean) =>
    el('button', { type: 'button', class: 'nav', 'aria-label': label, title: label, disabled, onclick: go(fn) }, picon(name));
  return el('div', { class: 'replay-nav', role: 'group', 'aria-label': 'מעבר בין המהלכים' },
    b('end-right', 'להתחלה', () => ctrl.view(0), cur === 0),
    b('chev-right', 'מהלך אחורה', () => ctrl.step(-1), cur === 0),
    b('chev-left', 'מהלך קדימה', () => ctrl.step(1), cur === n),
    b('end-left', 'לעמדה הנוכחית', () => ctrl.view(undefined), cur === n),
  );
}

function kifText(ctrl: FriendCtrl): string | null {
  return ctrl.game?.kif ?? null;
}

function kifRow(ctrl: FriendCtrl): HTMLElement | null {
  const kif = kifText(ctrl);
  if (!kif) return null;
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
  return el('div', { class: 'kif-export' },
    el('span', { class: 'small' }, 'רישום המשחק (KIF):', tipEl('kif')),
    b('הורדה', () => downloadKif(kif, kifFileName({ date: new Date(ctrl.game!.startedAt ?? Date.now()) }))),
    b('העתקה', async (btn) => flash(btn, (await copyText(kif)) ? 'הועתק ✓' : 'ההעתקה נכשלה')),
    b('ניתוח ב־Lishogi', async (btn) => {
      const ok = await copyText(kif);
      flash(btn, ok ? 'הועתק, ⟦הדבק|הדביקי⟧ בחלון שנפתח' : 'ההעתקה נכשלה');
      window.open(LISHOGI_IMPORT_URL, '_blank', 'noopener');
    }),
  );
}

function nudgeLink(ctrl: FriendCtrl): HTMLElement {
  const url = `${location.origin}${gameUrl(ctrl.id)}`;
  const text = `התור שלך במשחק השוגי שלנו: ${url}`;
  return el('a', { class: 'link', href: `https://wa.me/?text=${encodeURIComponent(text)}`, target: '_blank', rel: 'noopener', 'data-fid': 'nudge' }, 'תזכורת בוואטסאפ');
}

function status(ctrl: FriendCtrl, go: Go, onRematch: () => void): HTMLElement | null {
  const g = ctrl.game!;
  const opp = g.names[ctrl.opp];
  if (ctrl.ended) {
    const draw = g.status === 'finished' && !g.winner;
    const won = g.winner === g.you;
    const { title, text } = endText(g.endReason ?? 'abort', won, draw, opp);
    const guest = g.guest[g.you];
    return el('div', { class: `result ${g.status === 'aborted' || draw ? 'draw' : won ? 'won' : 'lost'}`, role: 'status' },
      el('strong', {}, title),
      el('p', {}, text),
      el('div', { class: 'buttons' },
        g.rematchId
          ? el('a', { class: 'btn primary', href: gameUrl(g.rematchId), 'data-fid': 'rematch-go' }, 'למשחק הנוסף')
          : g.rematchBy === ctrl.opp
            ? el('button', { type: 'button', class: 'btn primary', 'data-fid': 'rematch-yes', onclick: go(onRematch) }, `${opp} רוצה עוד משחק. מתחילים`)
            : g.rematchBy === g.you
              ? el('span', { class: 'small muted' }, 'ההזמנה למשחק נוסף נשלחה. הצבעים יתחלפו.')
              : el('button', { type: 'button', class: 'btn primary', 'data-fid': 'rematch', onclick: go(onRematch) }, 'עוד משחק (הצבעים מתחלפים)'),
        guest ? null : el('a', { class: 'link', href: '/games/' }, 'כל המשחקים שלי'),
      ),
      kifRow(ctrl),
      guest
        ? el('div', { class: 'signup' },
          el('p', {}, 'בחשבון חינמי המשחקים שלך נשמרים, ואפשר להזמין חברים בעצמך.'),
          el('a', { class: 'btn', href: '/account/?mode=signup', 'data-fid': 'signup' }, 'פתיחת חשבון בחינם'))
        : null,
      el('p', { class: 'small next-in-course' }, 'רוצה להשתפר? ', el('a', { href: '/try/' }, 'מתחילים כאן'), ' או ', el('a', { href: '/play/' }, 'משחקים נגד המחשב'), '.'),
    );
  }
  if (g.status !== 'active') return null;
  const pos = ctrl.line.current;
  const mine = pos.turn === g.you;
  const left = ctrl.deadlineLeft();
  const firstMoves = g.ply < 2;
  const parts: (HTMLElement | string | null)[] = [];
  parts.push(ctrl.pending ? 'שולחים…' : mine ? (pos.isCheck() ? 'שח! תורך.' : 'תורך.') : `התור של ${opp}.`);
  if (left !== null && left > 0) {
    if (firstMoves && g.speed === 'live') parts.push(el('span', { class: 'small muted' }, ' המשחק יבוטל אם לא ישוחק מהלך תוך ', el('span', { 'data-deadline-left': true }, hoursText(left)), '.'));
    else if (g.speed === 'corr') parts.push(el('span', { class: 'small muted' }, ` ${mine ? 'נשארו לך' : `ל${opp} נשארו`} `, el('span', { 'data-deadline-left': true }, hoursText(left)), ' למהלך.'));
  }
  if (!mine && g.speed === 'corr') parts.push(' ', nudgeLink(ctrl));
  return el('div', { class: 'status-line', 'aria-live': 'polite' },
    ...parts,
    ctrl.canImpasse ? el('button', { type: 'button', class: 'btn', onclick: go(() => ctrl.declareImpasse()) }, picon('crown'), ' הכרזת ניצחון בנקודות') : null,
    !ctrl.live ? el('button', { type: 'button', class: 'link', onclick: go(() => ctrl.view(undefined)) }, 'חזרה לעמדה הנוכחית') : null,
  );
}

function banners(ctrl: FriendCtrl, go: Go): HTMLElement | null {
  const g = ctrl.game!;
  const opp = g.names[ctrl.opp];
  if (g.status === 'active' && g.takebackBy === ctrl.opp) {
    return el('div', { class: 'play-tip', role: 'alert' },
      el('strong', {}, `בקשה מ${opp}: להחזיר מהלך?`),
      el('div', { class: 'buttons' },
        el('button', { type: 'button', class: 'btn primary', 'data-fid': 'tb-yes', onclick: go(() => ctrl.answerTakeback(true)) }, 'כן'),
        el('button', { type: 'button', class: 'btn', 'data-fid': 'tb-no', onclick: go(() => ctrl.answerTakeback(false)) }, 'לא')));
  }
  if (g.status === 'active' && g.takebackBy === g.you) {
    return el('div', { class: 'play-tip', role: 'status' }, el('p', {}, `ביקשת להחזיר מהלך. מחכים לתשובה של ${opp}.`));
  }
  if (ctrl.notice) {
    return el('div', { class: 'play-tip friend-signal', role: 'status' }, el('strong', {}, `${opp}: `), SIGNAL_TEXT[ctrl.notice as keyof typeof SIGNAL_TEXT]);
  }
  return null;
}

function controls(ctrl: FriendCtrl, go: Go): HTMLElement {
  const tool = (name: string, label: string, fn: () => void, opts: { disabled?: boolean; cls?: string; pressed?: boolean } = {}) =>
    el('button', { type: 'button', class: `tool${opts.cls ? ` ${opts.cls}` : ''}`, 'data-fid': `tool-${name}`, title: label, disabled: !!opts.disabled, 'aria-pressed': opts.pressed === undefined ? undefined : String(opts.pressed), onclick: go(fn) },
      picon(name), el('span', { class: 'label' }, label));
  if (ctrl.resignConfirm) {
    return el('div', { class: 'tools confirm', role: 'group', 'aria-label': 'אישור כניעה' },
      el('span', { class: 'q' }, ctrl.game!.ply < 2 ? 'לבטל את המשחק?' : 'להיכנע?'),
      tool('flag', ctrl.game!.ply < 2 ? 'כן, מבטלים' : 'כן, נכנעים', () => ctrl.resign(), { cls: 'danger' }),
      tool('close', 'לא, ממשיכים', () => ctrl.cancelResign()),
    );
  }
  return el('div', { class: 'tools', role: 'group', 'aria-label': 'פעולות במשחק' },
    tool('undo', 'בקשה להחזיר מהלך', () => ctrl.askTakeback(), { disabled: !ctrl.canTakeback }),
    tool('chat', 'הודעה', () => { ctrl.menu = ctrl.menu === 'messages' ? null : 'messages'; ctrl.redraw(); }, { disabled: ctrl.ended && !!ctrl.game?.rematchId, pressed: ctrl.menu === 'messages' }),
    tool('flip', 'הפיכת הלוח', () => ctrl.flip()),
    tool('flag', ctrl.game && ctrl.game.ply < 2 ? 'ביטול' : 'כניעה', () => ctrl.resign(), { disabled: !ctrl.active }),
    tool('shield', 'בטיחות', () => { ctrl.menu = ctrl.menu === 'safety' ? null : 'safety'; ctrl.redraw(); }, { pressed: ctrl.menu === 'safety' }),
  );
}

function menuBox(ctrl: FriendCtrl, go: Go, signedIn: boolean): HTMLElement | null {
  if (ctrl.menu === 'messages') {
    return el('div', { class: 'friend-menu', role: 'group', 'aria-label': 'הודעות קבועות' },
      el('p', { class: 'small muted' }, 'אפשר לשלוח רק הודעות קבועות, כדי שהמשחק יישאר נעים ובטוח לכולם.'),
      el('div', { class: 'friend-chips' }, ...SIGNALS.map((m) => el('button', { type: 'button', class: 'choice', 'data-fid': `sig-${m}`, onclick: go(() => ctrl.send(m)) }, SIGNAL_TEXT[m]))));
  }
  if (ctrl.menu === 'safety') {
    const g = ctrl.game!;
    const oppIsUser = !g.guest[ctrl.opp];
    return el('div', { class: 'friend-menu', role: 'group', 'aria-label': 'בטיחות' },
      ctrl.reported
        ? el('p', {}, 'תודה. הדיווח נשלח לצוות האתר.')
        : el('div', {},
          el('p', { class: 'small' }, 'משהו לא בסדר? הדיווח נשלח לצוות האתר יחד עם המשחק.'),
          el('div', { class: 'friend-chips' },
            ...([['name', 'שם לא ראוי'], ['cheat', 'משחק לא הוגן'], ['stall', 'מעכב את המשחק'], ['other', 'משהו אחר']] as const).map(([k, label]) =>
              el('button', { type: 'button', class: 'choice', 'data-fid': `report-${k}`, onclick: go(() => void ctrl.report(k)) }, label)))),
      signedIn && oppIsUser
        ? ctrl.blocked
          ? el('p', {}, `${g.names[ctrl.opp]} חסום. לא תוכלו לשחק יותר זה עם זה.`)
          : el('p', {}, el('button', { type: 'button', class: 'btn danger', 'data-fid': 'block', onclick: go(() => void ctrl.block()) }, `חסימה של ${g.names[ctrl.opp]}`),
            el('span', { class: 'small muted' }, ' המשחק הנוכחי ייגמר, ולא תוכלו לשחק יותר זה עם זה.'))
        : null,
      el('p', { class: 'small muted' }, 'אם משהו מדאיג או מפחיד אותך, ⟦ספר|ספרי⟧ למבוגר שאפשר לסמוך עליו. אפשר גם להתקשר למוקד 105 של המשטרה להגנה על ילדים ברשת: ', el('a', { href: 'tel:105' }, '105'), '.'),
    );
  }
  return null;
}

function problem(ctrl: FriendCtrl): HTMLElement {
  const text = ctrl.loadError === 'not-player'
    ? { title: 'המשחק הזה שמור למכשיר אחר', body: 'אפשר לשחק במשחק עם חבר רק מהמכשיר ומהחשבון שבהם נכנסת אליו. אם נכנסת עם חשבון, ⟦התחבר|התחברי⟧ אליו כאן.' }
    : ctrl.loadError === 'no-game'
      ? { title: 'לא מצאנו את המשחק', body: 'ייתכן שהקישור לא שלם. ⟦בקש|בקשי⟧ קישור חדש ממי שהזמין אותך.' }
      : { title: 'אין חיבור כרגע', body: 'לא הצלחנו לטעון את המשחק. ⟦בדוק|בדקי⟧ את החיבור לאינטרנט ⟦ונסה|ונסי⟧ שוב.' };
  return el('div', { class: 'screen' },
    el('h2', {}, text.title),
    el('p', {}, text.body),
    el('p', {}, el('a', { class: 'btn', href: ctrl.loadError === 'not-player' ? '/account/' : '/friend/' }, ctrl.loadError === 'not-player' ? 'כניסה לחשבון' : 'למשחק עם חבר')),
  );
}

export function render(ctrl: FriendCtrl, root: HTMLElement, opts: { signedIn: boolean; onRematch: () => void }): void {
  const go: Go = (fn) => (e) => { e.preventDefault(); e.stopPropagation(); fn(); };
  const q = <T extends HTMLElement = HTMLElement>(s: string) => root.querySelector<T>(s)!;
  const overlay = q('[data-overlay]');
  const g = ctrl.game;
  if (!g) {
    overlay.hidden = false;
    overlay.replaceChildren(ctrl.loadError ? problem(ctrl) : el('div', { class: 'screen' }, el('p', {}, 'טוענים את המשחק…')));
    return;
  }
  overlay.hidden = true;
  overlay.replaceChildren();
  const bar = q('[data-bar]');
  bar.replaceChildren(
    el('p', { class: 'play__what' }, el('strong', {}, 'משחק עם חבר'), ` · ${SPEED_TEXT(g.speed, g.days, g.clockSet).replace(/^משחק (איטי|חי): /, '')}`),
    el('a', { class: 'btn play__new', href: '/friend/' }, 'הזמנה חדשה'),
  );
  const top = ctrl.orientation === 'sente' ? 'gote' : 'sente';
  const table = q('[data-table]');
  const movesScroll = table.querySelector('[data-moves]')?.scrollTop;
  table.replaceChildren(
    el('div', { class: 'table-box' },
      banners(ctrl, go),
      playerRow(ctrl, top),
      el('div', { class: 'replay' },
        el('div', { class: 'moves-head' }, el('strong', {}, 'מהלכים')),
        moveList(ctrl, go), navButtons(ctrl, go)),
      status(ctrl, go, opts.onRematch),
      controls(ctrl, go),
      menuBox(ctrl, go, opts.signedIn),
      playerRow(ctrl, ctrl.orientation),
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
}
