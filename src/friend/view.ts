// AGPL-3.0-or-later, like the rest of this site.
import { el, icon, pieceSetSwitch } from '../learn/view';
import { localMove } from '../lib/move-notation';
import { copyText, downloadKif, kifFileName, LISHOGI_IMPORT_URL } from '../lib/kif';
import { scrollWithin } from '../lib/scroll-within';
import { tipEl } from '../lib/info-tip-dom';
import { openBug } from './bug';
import { gameUrl, personalUrl, REST_HINT, REST_LABEL, SIGNAL_TEXT, SPEED_TEXT } from './client';
import { pre } from './names';
import { waiting } from './waiting';
import { SIGNALS, type EndReason, type Reply } from './core';
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
  more: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
  'chev-down': '<path d="M6 9l6 6 6-6"/>',
  report: '<path d="M12 4.5l8.5 15h-17z"/><path d="M12 10.5v4"/><path d="M12 17.2v.1"/>',
  pieces: '<path d="M12 2.5L17.85 6.2L19.5 21H4.5L6.15 6.2Z"/><path d="M9.2 17.4l2.8-7.2 2.8 7.2M10.2 14.9h3.6"/>',
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

export function turnText(ms: number): string {
  const s = Math.floor(Math.max(0, ms) / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

function turnClock(ctrl: FriendCtrl, color: Color): HTMLElement | null {
  const t = ctrl.turnTime();
  if (ctrl.game?.clock || t === null || ctrl.line.current.turn !== color) return null;
  return el('span', { class: 'turn-time', dir: 'ltr', 'data-turn-time': true, title: 'כמה זמן עבר מתחילת התור', 'aria-label': 'כמה זמן עבר מתחילת התור' }, turnText(t));
}

export function hoursText(ms: number): string {
  const h = Math.floor(ms / 3600000);
  if (h >= 2) return `${h} שעות`;
  if (h === 1) return 'שעה';
  const m = Math.max(1, Math.ceil(ms / 60000));
  return m === 1 ? 'דקה' : `${m} דקות`;
}

export function endText(reason: EndReason, won: boolean, draw: boolean, opp: string, ply = 0): { title: string; text: string } {
  if (reason === 'abort' && ply >= 2) return { title: 'המשחק הסתיים בלי תוצאה', text: 'סיימתם את המשחק בהסכמה. אין מנצח ואין מפסיד, והמהלכים נשמרו.' };
  if (reason === 'abort') return { title: 'המשחק בוטל', text: 'המשחק בוטל לפני ששני הצדדים שיחקו מהלך, ולא נרשמה תוצאה.' };
  const title = draw ? 'תיקו' : won ? 'ניצחת!' : 'הפסד הפעם';
  const text: Record<Exclude<EndReason, 'abort'>, string> = {
    mate: won ? `מט. למלך של ${opp} אין לאן לברוח.` : 'מט. למלך שלך אין לאן לברוח.',
    stalemate: won ? `${pre('ל', opp)}${opp} לא נשאר אף מהלך חוקי, ובשוגי זה הפסד.` : 'לא נשאר לך אף מהלך חוקי, ובשוגי זה הפסד.',
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
      : turnClock(ctrl, color),
  );
}

function seatRow(ctrl: FriendCtrl, color: Color): HTMLElement {
  const g = ctrl.game!;
  const me = color === g.you;
  const t = g.clock ? ctrl.timeLeft(color) : undefined;
  const turn = ctrl.active && ctrl.line.current.turn === color;
  return el('div', { class: `ruser seat${turn ? ' turn' : ''}${g.clock?.running === color && ctrl.active ? ' running' : ''}` },
    el('span', { class: 'mark', 'aria-hidden': 'true' }, MARK[color]),
    el('span', { class: 'who' },
      el('strong', {}, me ? '⟦אתה|את⟧' : el('bdi', {}, g.names[color])),
      el('span', { class: 'small muted' }, `${SIDE[color]}${g.guest[color] ? (me ? ' · אורח' : ' · משחק כאורח') : ''}`)),
    g.clock
      ? el('span', { class: `rclock${t && t.main <= 0 ? ' byo' : ''}`, dir: 'ltr', 'data-clock': color }, clockText(ctrl, color))
      : turnClock(ctrl, color),
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

function nudgeLink(ctrl: FriendCtrl, cls = 'link'): HTMLElement {
  const url = `${location.origin}${gameUrl(ctrl.id)}`;
  const text = `התור שלך במשחק השוגי שלנו: ${url}`;
  return el('a', { class: cls, href: `https://wa.me/?text=${encodeURIComponent(text)}`, target: '_blank', rel: 'noopener', 'data-fid': 'nudge' }, 'תזכורת בוואטסאפ');
}

function paceLine(ctrl: FriendCtrl): HTMLElement {
  const g = ctrl.game!;
  const opp = g.names[ctrl.opp];
  const left = ctrl.active && g.speed === 'corr' ? ctrl.deadlineLeft() : null;
  const mine = ctrl.line.current.turn === g.you;
  return el('p', { class: 'small muted friend-pace' }, `${SPEED_TEXT(g.speed, g.days, g.clockSet)}.`,
    left !== null && left > 0
      ? el('span', {}, ` ${mine ? 'נשארו לך' : `${pre('ל', opp)}${opp} נשארו`} `, el('span', { 'data-deadline-left': true }, hoursText(left)), ' למהלך.')
      : null);
}

function replay(ctrl: FriendCtrl, go: Go): HTMLElement {
  const plies = ctrl.line.plies;
  const last = plies[plies.length - 1];
  return el('div', { class: `replay${ctrl.movesOpen ? ' open' : ''}` },
    el('div', { class: 'moves-head' },
      el('button', { type: 'button', class: 'moves-toggle', 'aria-expanded': String(ctrl.movesOpen), onclick: go(() => { ctrl.movesOpen = !ctrl.movesOpen; ctrl.redraw(); }) },
        el('strong', {}, plies.length ? `מהלכים (${plies.length})` : 'מהלכים'),
        last ? el('span', { class: 'small muted last' }, 'האחרון: ', el('bdi', { dir: 'ltr' }, localMove(last.western))) : null,
        picon('chev-down'))),
    moveList(ctrl, go), navButtons(ctrl, go));
}

function status(ctrl: FriendCtrl, go: Go, onRematch: () => void, signedIn: boolean): HTMLElement | null {
  const g = ctrl.game!;
  const opp = g.names[ctrl.opp];
  if (ctrl.ended) {
    const draw = g.status === 'finished' && !g.winner;
    const won = g.winner === g.you;
    const { title, text } = endText(g.endReason ?? 'abort', won, draw, opp, g.ply);
    const guest = g.guest[g.you];
    return el('div', { class: `result ${g.status === 'aborted' || draw ? 'draw' : won ? 'won' : 'lost'}`, role: 'status' },
      el('strong', {}, title),
      el('p', {}, text),
      g.rematchId && g.rematchBy === g.you ? el('p', { class: 'friend-ready' }, el('strong', {}, `יש תשובה ${pre('מ', opp)}`, el('bdi', {}, opp), ': כן. המשחק הנוסף מוכן.')) : null,
      el('div', { class: 'buttons' },
        g.rematchId
          ? el('a', { class: 'btn primary', href: gameUrl(g.rematchId), 'data-fid': 'rematch-go' }, 'למשחק הנוסף')
          : g.rematchBy === ctrl.opp
            ? el('button', { type: 'button', class: 'btn primary', 'data-fid': 'rematch-yes', onclick: go(onRematch) }, `${opp} רוצה עוד משחק. מתחילים`)
            : g.rematchBy === g.you
              ? waiting('ההזמנה למשחק נוסף נשלחה. מחכים לתשובה של ', el('bdi', {}, opp), '. הצבעים יתחלפו.')
              : el('button', { type: 'button', class: 'btn primary', 'data-fid': 'rematch', onclick: go(onRematch) }, 'עוד משחק (הצבעים מתחלפים)'),
        guest ? null : el('a', { class: 'link', href: '/games/' }, 'כל המשחקים שלי'),
      ),
      kifRow(ctrl),
      guest
        ? el('div', { class: 'signup' },
          el('p', {}, 'בחשבון חינמי המשחקים שלך נשמרים, ואפשר להזמין חברים בעצמך.'),
          signedIn
            ? el('button', { type: 'button', class: 'btn', 'data-fid': 'claim', onclick: go(() => ctrl.claim()) }, 'שמירת המשחק בחשבון שלי')
            : el('a', { class: 'btn', href: '/account/?mode=signup', 'data-fid': 'signup' }, 'פתיחת חשבון בחינם'))
        : null,
      el('p', { class: 'small next-in-course' }, 'רוצה להשתפר? ', el('a', { href: '/try/' }, 'מתחילים כאן'), ' או ', el('a', { href: '/play/' }, 'משחקים נגד המחשב'), '.'),
    );
  }
  if (g.status !== 'active') return null;
  const acts = [
    ctrl.canImpasse ? el('button', { type: 'button', class: 'btn', onclick: go(() => ctrl.declareImpasse()) }, picon('crown'), ' הכרזת ניצחון בנקודות') : null,
    !ctrl.live ? el('button', { type: 'button', class: 'link', onclick: go(() => ctrl.view(undefined)) }, 'חזרה לעמדה הנוכחית') : null,
  ].filter((a) => !!a) as HTMLElement[];
  return el('div', { class: `status-line${acts.length ? ' has-action' : ''}`, 'aria-live': 'polite' },
    el('span', { class: 'status-text' }, ...turnParts(ctrl)),
    ...acts,
  );
}

function jump(e: Event): void {
  e.preventDefault();
  const tip = (e.currentTarget as HTMLElement).closest('.play')?.querySelector<HTMLElement>('.play-tip.ask, .play-tip.wait');
  if (tip) window.scrollTo({ top: Math.max(0, tip.getBoundingClientRect().bottom + window.scrollY - window.innerHeight + 12), behavior: 'smooth' });
}

function turnParts(ctrl: FriendCtrl): (HTMLElement | string)[] {
  const g = ctrl.game!;
  const opp = g.names[ctrl.opp];
  const pos = ctrl.line.current;
  const mine = pos.turn === g.you;
  const left = ctrl.deadlineLeft();
  const parts: (HTMLElement | string)[] = [];
  parts.push(ctrl.pending ? 'שולחים…' : mine ? (pos.isCheck() ? 'שח! תורך.' : 'תורך.') : `התור של ${opp}.`);
  if (ctrl.asked || ctrl.reply) {
    parts.push(' ', el('button', { type: 'button', class: 'link friend-jump', onclick: jump }, `${ctrl.asked ? 'בקשה' : 'תשובה'} ${pre('מ', opp)}`, el('bdi', {}, opp), ' ↓'));
    return parts;
  }
  if (g.takebackBy === g.you || g.endBy === g.you) {
    parts.push(' ', waiting('מחכים לתשובה של ', el('bdi', {}, opp)));
    return parts;
  }
  if (left !== null && left > 0) {
    if (g.ply < 2 && g.speed === 'live') parts.push(el('span', { class: 'small muted' }, ' המשחק יבוטל אם לא ישוחק מהלך תוך ', el('span', { 'data-deadline-left': true }, hoursText(left)), '.'));
    else if (g.speed === 'corr') parts.push(el('span', { class: 'small muted' }, ` ${mine ? 'נשארו לך' : `${pre('ל', opp)}${opp} נשארו`} `, el('span', { 'data-deadline-left': true }, hoursText(left)), ' למהלך.'));
  }
  if (!mine && g.speed === 'corr') parts.push(' ', nudgeLink(ctrl));
  return parts;
}

const REPLY_TEXT: Record<Reply, (opp: string) => string> = {
  'tb-no': (opp) => `${opp} רוצה להמשיך בלי להחזיר מהלך. המשחק ממשיך מהעמדה הנוכחית.`,
  'tb-yes': (opp) => `המהלך הוחזר, באישור של ${opp}.`,
  'end-no': (opp) => `${opp} רוצה להמשיך לשחק. המשחק ממשיך.`,
};

function banners(ctrl: FriendCtrl, go: Go): HTMLElement[] {
  const g = ctrl.game!;
  const opp = g.names[ctrl.opp];
  const out: HTMLElement[] = [];
  const ask = (title: string, yes: string, no: string, fid: string, answer: (yes: boolean) => void) =>
    el('div', { class: 'play-tip ask', role: 'alert' },
      el('strong', {}, title),
      el('div', { class: 'buttons' },
        el('button', { type: 'button', class: 'btn primary', 'data-fid': `${fid}-yes`, disabled: ctrl.pending, onclick: go(() => answer(true)) }, yes),
        el('button', { type: 'button', class: 'btn', 'data-fid': `${fid}-no`, disabled: ctrl.pending, onclick: go(() => answer(false)) }, no)));
  const wait = (text: string, undo: string, fid: string, fn: () => void) =>
    el('div', { class: 'play-tip wait', role: 'status' }, el('p', {}, waiting(text), ' ',
      el('button', { type: 'button', class: 'link', 'data-fid': fid, disabled: ctrl.pending, onclick: go(fn) }, undo)));
  if (ctrl.alert) out.push(el('div', { class: 'play-tip', role: 'alert' }, el('p', {}, ctrl.alert, ' ', ctrl.alertBug ? el('button', { type: 'button', class: 'link', onclick: go(openBug) }, 'זה קורה שוב? דיווח על תקלה') : null)));
  if (ctrl.active && g.endBy === ctrl.opp) out.push(ask(`הצעה ${pre('מ', opp)}${opp}: לסיים את המשחק בלי תוצאה?`, 'כן, מסיימים', 'לא, ממשיכים', 'end', (yes) => ctrl.answerEnd(yes)));
  if (ctrl.active && g.takebackBy === ctrl.opp) {
    const two = ctrl.line.current.turn === ctrl.opp;
    out.push(ask(two ? `בקשה ${pre('מ', opp)}${opp}: להחזיר שני מהלכים, גם את המהלך האחרון שלך?` : `בקשה ${pre('מ', opp)}${opp}: להחזיר את המהלך האחרון?`, 'כן', 'לא', 'tb', (yes) => ctrl.answerTakeback(yes)));
  }
  if (ctrl.reply) {
    out.push(el('div', { class: 'play-tip ask reply', role: 'alert' },
      el('p', {}, REPLY_TEXT[ctrl.reply](opp)),
      el('button', { type: 'button', class: 'link', 'data-fid': 'reply-ok', onclick: go(() => ctrl.dismissReply()) }, 'הבנתי')));
  }
  if (ctrl.active && g.endBy === g.you) out.push(wait(`הצעת לסיים את המשחק בלי תוצאה. מחכים לתשובה של ${opp}.`, 'ביטול ההצעה', 'end-cancel', () => ctrl.cancelEnd()));
  if (ctrl.active && g.takebackBy === g.you) out.push(wait(`ביקשת להחזיר מהלך. מחכים לתשובה של ${opp}.`, 'ביטול הבקשה', 'tb-cancel', () => ctrl.cancelTakeback()));
  if (ctrl.notice) out.push(el('div', { class: 'play-tip friend-signal', role: 'status' }, el('strong', {}, `${opp}: `), SIGNAL_TEXT[ctrl.notice as keyof typeof SIGNAL_TEXT]));
  return out;
}

function controls(ctrl: FriendCtrl, go: Go): HTMLElement {
  const tool = (name: string, label: string, fn: () => void, opts: { disabled?: boolean; cls?: string; pressed?: boolean } = {}) =>
    el('button', { type: 'button', class: `tool${opts.cls ? ` ${opts.cls}` : ''}`, 'data-fid': `tool-${name}`, title: label, disabled: !!opts.disabled, 'aria-pressed': opts.pressed === undefined ? undefined : String(opts.pressed), onclick: go(fn) },
      picon(name), el('span', { class: 'label' }, label));
  if (ctrl.resignConfirm) {
    return el('div', { class: 'tools confirm', role: 'group', 'aria-label': 'אישור כניעה' },
      el('span', { class: 'q' }, 'להיכנע?'),
      tool('flag', 'כן, נכנעים', () => ctrl.resign(), { cls: 'danger' }),
      tool('close', 'לא, ממשיכים', () => ctrl.cancelResign()),
    );
  }
  const open = (m: NonNullable<FriendCtrl['menu']>) => () => { ctrl.menu = ctrl.menu === m ? null : m; ctrl.redraw(); };
  return el('div', { class: 'tools', role: 'group', 'aria-label': 'פעולות במשחק' },
    tool('undo', 'החזרת מהלך', () => ctrl.askTakeback(), { disabled: !ctrl.canTakeback }),
    tool('chat', 'הודעה', open('messages'), { disabled: ctrl.ended && !!ctrl.game?.rematchId, pressed: ctrl.menu === 'messages' }),
    tool('flag', 'סיום', open('end'), { disabled: !ctrl.active, pressed: ctrl.menu === 'end' }),
    tool('pieces', 'סימון הכלים', open('pieces'), { pressed: ctrl.menu === 'pieces' }),
    tool('more', 'עוד', open('more'), { pressed: ctrl.menu === 'more' || ctrl.menu === 'rest' || ctrl.menu === 'keep' || ctrl.menu === 'safety' }),
  );
}

function keepLine(ctrl: FriendCtrl, go: Go): HTMLElement | null {
  const g = ctrl.game!;
  if (!g.guest[g.you] || !ctrl.active || ctrl.menu === 'keep') return null;
  return el('p', { class: 'friend-keepline small' }, el('span', { class: 'keep-why' }, el('span', { class: 'keep-acct' }, 'בלי חשבון '), 'המשחק שמור רק בדפדפן הזה.'), ' ',
    el('button', { type: 'button', class: 'link', 'data-fid': 'keep', onclick: go(() => { ctrl.menu = 'keep'; ctrl.redraw(); }) }, 'שמירת המשחק שלי'));
}

function menuBox(ctrl: FriendCtrl, go: Go, signedIn: boolean, phone: boolean): HTMLElement | null {
  if (ctrl.menu === 'messages') {
    return el('div', { class: 'friend-menu', role: 'group', 'aria-label': 'הודעות קבועות' },
      el('p', { class: 'small muted' }, 'אפשר לשלוח רק הודעות קבועות, כדי שהמשחק יישאר נעים ובטוח לכולם.'),
      el('div', { class: 'friend-chips' }, ...SIGNALS.map((m) => el('button', { type: 'button', class: 'choice', 'data-fid': `sig-${m}`, onclick: go(() => ctrl.send(m)) }, SIGNAL_TEXT[m]))));
  }
  if (ctrl.menu === 'end' && ctrl.active) {
    const g = ctrl.game!;
    const opp = () => el('bdi', {}, g.names[ctrl.opp]);
    const option = (label: string, fid: string, fn: () => void, text: (HTMLElement | string)[], danger = false, disabled = false) =>
      el('button', { type: 'button', class: `friend-end__option${danger ? ' danger' : ''}`, 'data-fid': fid, disabled: disabled || ctrl.pending, onclick: go(fn) },
        el('strong', {}, label),
        el('span', {}, ...text));
    const keep = el('button', { type: 'button', class: 'friend-end__keep', 'data-fid': 'end-keep', onclick: go(() => { ctrl.menu = null; ctrl.redraw(); }) }, 'ממשיכים לשחק');
    if (g.ply < 2) {
      return el('div', { class: 'friend-menu friend-end', role: 'group', 'aria-label': 'סיום המשחק' },
        option('ביטול המשחק', 'end-abort', () => ctrl.resign(), ['עוד לא שיחקתם שניכם מהלך, אז המשחק פשוט מתבטל, בלי תוצאה.'], true),
        keep);
    }
    return el('div', { class: 'friend-menu friend-end', role: 'group', 'aria-label': 'סיום המשחק' },
      g.endBy === ctrl.opp
        ? option('לסיים בלי תוצאה', 'end-accept', () => ctrl.answerEnd(true), ['יש הצעה כזאת ' + pre('מ', g.names[ctrl.opp]), opp(), '. המשחק נגמר עכשיו, בלי מנצח ובלי מפסיד.'])
        : g.endBy === g.you
          ? option('ביטול ההצעה שלי', 'end-cancel-menu', () => ctrl.cancelEnd(), ['הצעת לסיים בלי תוצאה, ועוד אין תשובה ' + pre('מ', g.names[ctrl.opp]), opp(), '.'])
          : option('הצעה לסיים בלי תוצאה', 'end-offer', () => ctrl.offerEnd(),
            ctrl.canOfferEnd ? ['המשחק נגמר בלי מנצח ובלי מפסיד, אבל רק באישור של ', opp(), '.'] : ['ההצעה הקודמת לא התקבלה. אפשר להציע שוב אחרי שכל אחד מכם ישחק מהלך.'], false, !ctrl.canOfferEnd),
      option('כניעה', 'end-resign', () => ctrl.resign(), ['המשחק נגמר עכשיו, והניצחון נרשם ל', opp(), '.'], true),
      keep);
  }
  if (ctrl.menu === 'pieces') {
    return el('div', { class: 'friend-menu friend-pieces', role: 'group', 'aria-label': 'סימון הכלים' },
      el('div', { class: 'pieces-switch' }, pieceSetSwitch(), tipEl('pieces')));
  }
  if (ctrl.menu === 'more') {
    const g = ctrl.game!;
    const pick = (label: string, fid: string, fn: () => void) => el('button', { type: 'button', class: 'choice', 'data-fid': fid, onclick: go(fn) }, label);
    const oppTurn = ctrl.active && g.speed === 'corr' && ctrl.line.current.turn === ctrl.opp;
    return el('div', { class: 'friend-menu friend-extra', role: 'group', 'aria-label': 'עוד' },
      phone ? replay(ctrl, go) : null,
      el('div', { class: 'friend-chips' },
        pick('בטיחות', 'tool-shield', () => { ctrl.menu = 'safety'; ctrl.redraw(); }),
        pick('הפיכת הלוח', 'tool-flip', () => { ctrl.menu = null; ctrl.flip(); }),
        ctrl.active && g.speed === 'corr' ? pick(g.rest ? 'לא לשחק בשבת ✓' : 'הגדרת שבת', 'rest', () => { ctrl.menu = 'rest'; ctrl.redraw(); }) : null,
        g.guest[g.you] ? pick('שמירת המשחק שלי', 'keep-more', () => { ctrl.menu = 'keep'; ctrl.redraw(); }) : null,
        phone && oppTurn ? nudgeLink(ctrl, 'choice') : null,
        pick('דיווח על תקלה', 'bug', () => { ctrl.menu = null; ctrl.redraw(); openBug(); })),
      phone ? paceLine(ctrl) : null);
  }
  if (ctrl.menu === 'rest') {
    const box = el('input', { type: 'checkbox', id: 'friend-rest', 'data-fid': 'rest-box', disabled: ctrl.pending }) as HTMLInputElement;
    box.checked = !!ctrl.game?.rest;
    box.addEventListener('change', () => ctrl.setRest(box.checked));
    return el('div', { class: 'friend-menu friend-rest', role: 'group', 'aria-label': 'שבת' },
      el('label', { for: 'friend-rest' }, box, ' ', REST_LABEL),
      el('p', { class: 'small muted' }, REST_HINT));
  }
  if (ctrl.menu === 'keep') {
    const url = personalUrl(ctrl.id);
    const copyBtn = el('button', { type: 'button', class: 'choice', 'data-fid': 'keep-copy' }, 'העתקת הקישור האישי');
    copyBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      copyBtn.textContent = url && (await copyText(url)) ? 'הועתק ✓' : 'ההעתקה נכשלה';
    });
    return el('div', { class: 'friend-menu', role: 'group', 'aria-label': 'שמירת המשחק' },
      el('p', { class: 'small' }, 'בלי חשבון המשחק שמור רק בדפדפן הזה. עם הקישור האישי אפשר לחזור אליו מכל דפדפן ומכל מכשיר.'),
      url
        ? el('div', { class: 'friend-chips' },
          copyBtn,
          el('a', { class: 'choice', href: `https://wa.me/?text=${encodeURIComponent(`הקישור האישי שלי למשחק השוגי: ${url}`)}`, target: '_blank', rel: 'noopener', 'data-fid': 'keep-wa' }, 'שליחה לעצמי בוואטסאפ'))
        : null,
      url ? el('p', { class: 'small muted' }, 'הקישור הזה רק שלך. מי שמחזיק בו יכול לשחק במקומך.') : null,
      signedIn
        ? el('p', {}, el('button', { type: 'button', class: 'btn', 'data-fid': 'claim', onclick: go(() => ctrl.claim()) }, 'שמירת המשחק בחשבון שלי'))
        : el('p', { class: 'small' }, 'עם חשבון חינמי המשחק נשמר בכל מכשיר: ', el('a', { href: '/account/?mode=signup' }, 'פתיחת חשבון'), '. אחרי הכניסה ⟦חזור|חזרי⟧ לעמוד הזה ⟦ולחץ|ולחצי⟧ שוב על "שמירת המשחק שלי".'));
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
    ? { title: 'לא זיהינו אותך במשחק הזה', body: 'למשחק נכנסים מהחשבון ששיחקת בו, או עם הקישור האישי ששמרת. אם שיחקת עם חשבון, ⟦התחבר|התחברי⟧ אליו כאן.' }
    : ctrl.loadError === 'no-game'
      ? { title: 'לא מצאנו את המשחק', body: 'ייתכן שהקישור לא שלם. ⟦בקש|בקשי⟧ קישור חדש ממי שהזמין אותך.' }
      : ctrl.loadError === 'paused'
        ? { title: 'הפסקה קצרה', body: 'המשחק עם חבר בהפסקה קצרה. המשחק שלך שמור, ונחזור בקרוב.' }
        : { title: 'אין חיבור כרגע', body: 'לא הצלחנו לטעון את המשחק. ⟦בדוק|בדקי⟧ את החיבור לאינטרנט ⟦ונסה|ונסי⟧ שוב.' };
  return el('div', { class: 'screen' },
    el('h2', {}, text.title),
    el('p', {}, text.body),
    el('p', {}, el('a', { class: 'btn', href: ctrl.loadError === 'not-player' ? '/account/' : '/friend/' }, ctrl.loadError === 'not-player' ? 'כניסה לחשבון' : 'למשחק עם חבר')),
    ctrl.loadError === 'paused' ? null : el('p', { class: 'small' }, 'זה לא אמור לקרות? ', el('button', { type: 'button', class: 'link', onclick: openBug }, 'דיווח על תקלה')),
  );
}

const PHONE = '(max-width: 859.98px)';
const isPhone = (): boolean => window.matchMedia(PHONE).matches;
let shown = '';

function reveal(target: HTMLElement | null): void {
  if (!target) return;
  const r = target.getBoundingClientRect();
  const over = r.bottom - window.innerHeight + 10;
  if (over > 0) window.scrollTo({ top: window.scrollY + over, behavior: 'smooth' });
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
  const phone = isPhone();
  const bar = q('[data-bar]');
  const pace = SPEED_TEXT(g.speed, g.days, g.clockSet).replace(/^משחק (בלי שעון|חי): /, '');
  bar.replaceChildren(
    el('p', { class: 'play__what' }, el('strong', {}, 'משחק עם חבר'), ` · ${pace}`),
    el('button', { type: 'button', class: 'friend-report', 'data-fid': 'bug-top', 'aria-label': 'דיווח על תקלה', onclick: openBug }, picon('report'), el('span', {}, 'דיווח על תקלה')),
    el('a', { class: 'btn play__new', href: '/friend/' }, 'הזמנה חדשה'),
  );
  const top = ctrl.orientation === 'sente' ? 'gote' : 'sente';
  const turn = ctrl.active ? ctrl.line.current.turn : null;
  root.classList.toggle('turn-bottom', turn === ctrl.orientation);
  root.classList.toggle('turn-top', turn === top);
  root.classList.toggle('is-guest', g.guest[g.you] && ctrl.active);
  const table = q('[data-table]');
  const movesScroll = table.querySelector('[data-moves]')?.scrollTop;
  const tips = banners(ctrl, go);
  const menu = menuBox(ctrl, go, opts.signedIn, phone);
  const tools = controls(ctrl, go);
  table.replaceChildren(
    el('div', { class: 'table-box' },
      ...tips,
      playerRow(ctrl, top),
      phone ? null : replay(ctrl, go),
      status(ctrl, go, opts.onRematch, opts.signedIn),
      tools,
      keepLine(ctrl, go),
      menu,
      playerRow(ctrl, ctrl.orientation),
    ),
  );
  for (const [where, color] of [['top', top], ['bottom', ctrl.orientation]] as const) {
    const seat = q(`[data-seat="${where}"]`);
    seat.hidden = false;
    seat.replaceChildren(seatRow(ctrl, color));
  }
  const box = table.querySelector<HTMLElement>('[data-moves]');
  if (box) {
    const active = box.querySelector<HTMLElement>('.mv.active');
    if (ctrl.live || !active) box.scrollTop = box.scrollHeight;
    else if (movesScroll !== undefined) box.scrollTop = movesScroll;
    if (active) scrollWithin(box, active);
  }
  const asks = tips.filter((t) => !t.classList.contains('friend-signal'));
  const done = ctrl.ended ? table.querySelector<HTMLElement>('.result .buttons') : null;
  const key = `${ctrl.menu ?? ''}|${ctrl.movesOpen && ctrl.menu === 'more'}|${g.status}|${asks.map((t) => t.className + t.textContent).join('|')}`;
  if (phone && key !== shown && (menu || asks.length || done)) requestAnimationFrame(() => reveal(menu ?? done ?? tools));
  shown = key;
}
