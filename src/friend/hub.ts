// AGPL-3.0-or-later, like the rest of this site.
import { el } from '../learn/view';
import { accountsEnabled } from '../lib/account-config';
import { isAndroid, isInApp } from '../lib/install';
import { copyText } from '../lib/kif';
import { openBug, setBugContext } from './bug';
import { api, endUrl, gameUrl, type InviteInfo, inviteUrl, lapsedSeen, type ListedGame, markLapsed, readSeats, rememberedInvite, rememberInvite, REST_HINT, REST_LABEL, restPref, saveName, savedName, setRestPref, SHORT_SPEED, signedIn, SPEED_TEXT, takeDropped } from './client';
import { CORR_DAYS, MAX_SLOTS } from './core';
import { LABEL_MAX, NAME_MAX, type NameProblem, nameProblem, pre, tidyLabel, tidyName } from './names';
import { thumbBoard } from './thumb';
import { waiting as waitLine } from './waiting';

const COLOR_TEXT: Record<Color | 'random', string> = { random: 'הגרלה', sente: 'פותח (☗)', gote: 'משיב (☖)' };

const NO_CLOCK = 'משחק אחד, בלי שעון. לכל מהלך יש עד 3 ימים, וכל אחד משחק מתי שנוח לו.';
const POLL_MS = 30_000;
const LAPSED_SHOW_MS = 14 * 864e5;

const codeFromHash = (): string | null => {
  const asked = new URLSearchParams(location.search).get('i');
  const c = (asked ?? location.hash.replace(/^#/, '')).trim().toLowerCase();
  if (!/^[a-z0-9]{10}$/.test(c)) return null;
  if (asked) history.replaceState(null, '', `${location.pathname}#${c}`);
  return c;
};
const remember = rememberInvite;
const remembered = (): string | null => rememberedInvite();

const ERR: Record<string, string> = {
  nickname: 'כדי להזמין חבר צריך כינוי בחשבון. אפשר לבחור אחד בעמוד החשבון.',
  full: 'יש לך כבר 2 משחקים או הזמנות פתוחות. אפשר להתחיל משחק נוסף כשאחד מהם נגמר.',
  'sign-in': 'צריך להיכנס לחשבון כדי להזמין.',
  network: 'אין חיבור לרשת כרגע. כדאי לנסות שוב בעוד רגע.',
  paused: 'המשחק עם חבר בהפסקה קצרה. המשחקים שמורים, ונחזור בקרוב.',
};
const NAME_ERR: Record<NameProblem, string> = {
  empty: 'צריך שם כדי להתחיל לשחק.',
  short: 'השם קצר מדי. צריך לפחות 2 תווים.',
  long: `השם ארוך מדי. אפשר עד ${NAME_MAX} תווים.`,
  chars: 'בשם אפשר להשתמש באותיות בעברית או באנגלית, במספרים וברווח.',
  letter: 'בשם צריכה להיות לפחות אות אחת.',
  phone: 'אי אפשר לשים מספר טלפון בשם.',
  blocked: 'אי אפשר להשתמש בשם הזה. כדאי לבחור שם אחר.',
};
let lastError = '-';
const errText = (e?: string) => {
  lastError = e ?? 'unknown';
  return (e && ERR[e]) || 'משהו השתבש. כדאי לנסות שוב.';
};
const bugLink = () => el('button', { type: 'button', class: 'link', onclick: openBug }, 'דיווח על תקלה');

function shareRow(code: string): HTMLElement {
  const url = inviteUrl(code);
  const msg = `רוצה לשחק איתי שוגי? הנה קישור למשחק, בלי הרשמה: ${url}`;
  const copyBtn = el('button', { type: 'button', class: 'btn btn-ghost' }, 'העתקת הקישור');
  copyBtn.addEventListener('click', async () => {
    const ok = await copyText(url);
    copyBtn.textContent = ok ? 'הועתק ✓' : 'ההעתקה נכשלה';
    window.setTimeout(() => { copyBtn.textContent = 'העתקת הקישור'; }, 2000);
  });
  const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
  return el('div', { class: 'friend-share' },
    el('p', { class: 'friend-link', dir: 'ltr' }, el('bdi', {}, url)),
    el('div', { class: 'friend-actions' },
      el('a', { class: 'btn', href: `https://wa.me/?text=${encodeURIComponent(msg)}`, target: '_blank', rel: 'noopener' }, 'שליחה בוואטסאפ'),
      copyBtn,
      nav.share ? el('button', { type: 'button', class: 'btn btn-ghost', onclick: () => void nav.share!({ title: 'שוגי ישראל', text: msg }).catch(() => {}) }, 'שיתוף') : null,
    ),
  );
}

function inAppNote(code: string): HTMLElement {
  const android = isAndroid();
  const copyBtn = el('button', { type: 'button', class: 'btn btn-ghost' }, 'העתקת הקישור');
  copyBtn.addEventListener('click', async () => {
    copyBtn.textContent = (await copyText(inviteUrl(code))) ? 'הועתק. ⟦הדבק|הדביקי⟧ אותו בדפדפן' : 'ההעתקה נכשלה';
  });
  return el('div', { class: 'friend-note', role: 'note' },
    el('strong', {}, android ? 'כדאי לפתוח ב־Chrome' : 'כדאי לפתוח בדפדפן הרגיל'),
    el('p', {}, 'הדף נפתח בתוך אפליקציה, והמשחק עלול להיעלם כשהיא נסגרת. בדפדפן הרגיל הוא נשמר.'),
    el('div', { class: 'friend-actions' },
      android ? el('a', { class: 'btn', href: `intent://${location.host}/friend/?i=${code}#Intent;scheme=https;package=com.android.chrome;end` }, 'פתיחה ב־Chrome') : null,
      copyBtn),
    el('p', { class: 'small muted' }, android
      ? 'אם הכפתור לא עובד: ⟦לחץ|לחצי⟧ על ⋮ למעלה ⟦ובחר|ובחרי⟧ פתיחה בדפדפן.'
      : '⟦לחץ|לחצי⟧ על ⋯ ⟦ובחר|ובחרי⟧ פתיחה בדפדפן.'),
  );
}

function restField(): HTMLElement {
  const box = el('input', { type: 'checkbox', id: 'friend-rest' }) as HTMLInputElement;
  box.checked = restPref();
  box.addEventListener('change', () => setRestPref(box.checked));
  return el('div', { class: 'friend-field friend-rest' },
    el('label', { for: 'friend-rest' }, box, ' ', REST_LABEL),
    el('p', { class: 'small muted' }, REST_HINT));
}

const movesText = (n: number): string => (n === 1 ? 'מהלך אחד' : `${n} מהלכים`);
const endedText = (iso: string): string => {
  const d = new Date(iso);
  const day = d.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric', ...(d.getFullYear() === new Date().getFullYear() ? {} : { year: 'numeric' }) });
  return `נגמר ב-${day}, ${d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`;
};
const oppOf = (g: ListedGame): string => (g.you ? g.names[g.you === 'sente' ? 'gote' : 'sente'] : '');

interface Naming { editing: string | null; open: (id: string) => void; close: () => void; save: (g: ListedGame, label: string) => Promise<boolean> }

function labelEditor(g: ListedGame, naming: Naming): HTMLElement {
  const input = el('input', {
    type: 'text', maxlength: String(LABEL_MAX), value: g.label ?? '', dir: 'auto', enterkeyhint: 'done',
    'aria-label': 'שם למשחק', placeholder: 'למשל: המשחק הראשון עם אבא',
  }) as HTMLInputElement;
  const err = el('p', { class: 'friend-name__err', role: 'alert' });
  const saveBtn = el('button', { type: 'button', class: 'btn' }, 'שמירה') as HTMLButtonElement;
  const go = async () => {
    saveBtn.disabled = true;
    err.textContent = '';
    if (!(await naming.save(g, tidyLabel(input.value)))) {
      err.textContent = 'לא הצלחנו לשמור. כדאי לנסות שוב.';
      saveBtn.disabled = false;
    }
  };
  saveBtn.addEventListener('click', () => void go());
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); void go(); }
    if (e.key === 'Escape') naming.close();
  });
  window.setTimeout(() => input.focus(), 0);
  return el('div', { class: 'friend-field friend-name friend-label-edit' },
    input,
    err,
    el('p', { class: 'small muted' }, 'השם נשמר רק אצלך, והחבר לא רואה אותו.'),
    el('div', { class: 'friend-actions' }, saveBtn, el('button', { type: 'button', class: 'btn btn-ghost', onclick: naming.close }, 'ביטול')));
}

function gameRow(g: ListedGame, naming?: Naming): HTMLElement {
  const opp = oppOf(g);
  const what = SHORT_SPEED(g.speed, g.days, g.clock);
  const active = g.status === 'active';
  const result = g.waits ? (g.waits === 'rematch' ? `${opp} רוצה עוד משחק` : `בקשה ${pre('מ', opp)}${opp}`)
    : active ? (g.yourTurn ? 'תורך' : `התור של ${opp}`)
      : g.status === 'aborted' ? (g.ply >= 2 ? 'בלי תוצאה' : 'בוטל')
        : !g.winner ? 'תיקו' : g.winner === g.you ? 'ניצחת' : 'הפסד';
  const hot = g.yourTurn || !!g.waits;
  return withBoard(`friend-row${hot ? ' turn' : ''}`, g.id, active ? thumbBoard(g.id, g.sfen, g.you, g.last) : null,
    el('a', { href: gameUrl(g.id), class: 'friend-row__main' },
      el('strong', {}, !active && g.label ? el('bdi', {}, g.label) : `נגד ${opp}`),
      !active && g.label ? el('span', { class: 'small muted' }, `נגד ${opp}`) : null,
      el('span', { class: 'small muted' }, active ? what : endedText(g.endedAt ?? g.updatedAt)),
      el('span', { class: 'small muted' }, movesText(g.ply))),
    el('span', { class: `friend-tag${hot ? ' hot' : ''}` }, result),
    active ? el('a', { class: 'link friend-row__end', href: endUrl(g.id) }, 'סיום המשחק')
      : naming && naming.editing === g.id ? labelEditor(g, naming)
        : naming ? el('button', { type: 'button', class: 'link friend-row__end', onclick: () => naming.open(g.id) }, g.label ? 'שינוי השם של המשחק' : 'הוספת שם למשחק') : null,
  );
}

function withBoard(cls: string, id: string, board: HTMLElement | null, ...body: (HTMLElement | null)[]): HTMLElement {
  if (!board) return el('li', { class: cls }, ...body);
  return el('li', { class: `${cls} friend-row--board` },
    el('a', { href: gameUrl(id), class: 'friend-thumb-link', tabindex: '-1', 'aria-hidden': 'true' }, board),
    el('div', { class: 'friend-row__body' }, ...body));
}

function deviceGames(box: HTMLElement, list: HTMLElement, skip: (id: string) => boolean = () => false): void {
  const seats = Object.keys(readSeats()).filter((id) => !skip(id)).slice(-5).reverse();
  if (!seats.length) return;
  void Promise.all(seats.map((id) => api.state(id))).then((rs) => {
    const games = rs.flatMap((r) => (r.ok && r.data.game.guest[r.data.game.you] ? [r.data.game] : []));
    if (!games.length) return;
    box.hidden = false;
    list.replaceChildren(...games.sort((a, b) => Number(b.status === 'active') - Number(a.status === 'active')).map((g) => {
      const opp = g.names[g.you === 'sente' ? 'gote' : 'sente'];
      const yourTurn = g.status === 'active' && (g.ply % 2 === 0 ? 'sente' : 'gote') === g.you;
      return withBoard(`friend-row${yourTurn ? ' turn' : ''}`, g.id, g.status === 'active' ? thumbBoard(g.id, g.sfen, g.you, g.moves.at(-1)) : null,
        el('a', { href: gameUrl(g.id), class: 'friend-row__main' }, el('strong', {}, `נגד ${opp}`),
          g.status !== 'active' && g.endedAt ? el('span', { class: 'small muted' }, endedText(g.endedAt)) : null,
          el('span', { class: 'small muted' }, movesText(g.ply))),
        el('span', { class: `friend-tag${yourTurn ? ' hot' : ''}` }, g.status === 'active' ? (yourTurn ? 'תורך' : `התור של ${opp}`) : 'הסתיים'));
    }));
  });
}

export async function bootHub(root: HTMLElement): Promise<void> {
  const me = await signedIn();
  const hashCode = codeFromHash();
  const code = hashCode ?? (me ? remembered() : null);
  setBugContext(() => ({ code: code ?? undefined, context: `hub signedIn=${me} lastError=${lastError}` }));
  if (code) return invitePage(root, code, me);
  remember(null);
  return me ? homeSignedIn(root) : homeGuest(root);
}

function homeGuest(root: HTMLElement): void {
  const list = el('ul', { class: 'friend-list' });
  const box = el('section', { class: 'friend-card', hidden: true }, el('h2', {}, 'המשחקים שלך במכשיר הזה'), list);
  root.replaceChildren(
    takeDropped()
      ? el('div', { class: 'friend-note', role: 'status' },
        el('strong', {}, 'החשבון התנתק במכשיר הזה'),
        el('p', {}, 'כדי להזמין חבר ולראות את המשחקים שלך, צריך להיכנס שוב.'))
      : '',
    el('section', { class: 'friend-card' },
      el('h2', {}, 'איך זה עובד'),
      el('ol', { class: 'friend-steps' },
        el('li', {}, 'מי שמזמין צריך חשבון (בחינם) עם כינוי.'),
        el('li', {}, 'שולחים לחבר קישור בוואטסאפ.'),
        el('li', {}, 'החבר לוחץ על הקישור ומשחק, גם בלי הרשמה.')),
      el('p', {}, 'אין צ׳אט פתוח: אפשר לשלוח רק הודעות קבועות, כמו "בהצלחה!" או "משחק טוב!".'),
      accountsEnabled
        ? el('a', { class: 'btn', href: '/account/' }, 'כניסה לחשבון כדי להזמין')
        : el('p', { class: 'muted' }, 'החשבונות לא פעילים כאן.'),
    ),
    box,
  );
  deviceGames(box, list);
}

function homeSignedIn(root: HTMLElement): void {
  let color: Color | 'random' = 'random';
  let games: ListedGame[] = [];
  let loaded = false;
  let adding = false;
  let fresh = '';
  let shown = { wait: '', make: '' };
  const watching = new Map<string, () => void>();
  const msg = el('p', { class: 'friend-msg', role: 'status' });
  const notes = el('div', { class: 'friend-notes', role: 'status' });
  const waitBox = el('div', { class: 'friend-wait' });
  const makeBox = el('section', { class: 'friend-card' }, el('p', { class: 'muted' }, 'טוענים…'));
  const list = el('ul', { class: 'friend-list' });
  const places = el('p', { class: 'small muted' });
  const stats = el('p', { class: 'friend-stats' });
  const listBox = el('section', { class: 'friend-card', hidden: true }, el('h2', {}, 'המשחקים שלך עם חברים'), places, list, stats,
    el('p', { class: 'small' }, el('a', { href: '/games/' }, 'כל המשחקים שלי, עם צפייה חוזרת וקובץ KIF')));
  const waiting = () => games.filter((g) => g.status === 'open' && Date.parse(g.expiresAt) > Date.now());
  const running = () => games.filter((g) => g.status === 'active' && g.you);

  const watch = async () => {
    const want = new Set(waiting().map((g) => g.id));
    for (const [id, stop] of watching) if (!want.has(id)) { stop(); watching.delete(id); }
    const missing = [...want].filter((id) => !watching.has(id));
    if (!missing.length) return;
    const { supabase } = await import('../lib/account');
    for (const id of missing) {
      if (watching.has(id)) continue;
      const ch = supabase().channel(`fg:${id}`).on('broadcast', { event: 'changed' }, () => void load()).subscribe();
      watching.set(id, () => { void supabase().removeChannel(ch); });
    }
  };

  const started = (g: ListedGame): HTMLElement => {
    const opp = oppOf(g);
    return el('div', { class: 'friend-note friend-started' },
      el('strong', {}, 'המשחק נגד ', el('bdi', {}, opp), ' התחיל'),
      el('p', {}, g.yourTurn ? 'תורך.' : el('span', {}, 'התור של ', el('bdi', {}, opp), '.')),
      el('a', { class: 'btn', href: gameUrl(g.id) }, 'למשחק'));
  };

  let lapsedNote: HTMLElement | null = null;
  const lapsed = () => {
    const seen = lapsedSeen();
    const ids = games.filter((g) => g.status === 'open' && Date.now() - Date.parse(g.expiresAt) >= 0 && Date.now() - Date.parse(g.expiresAt) < LAPSED_SHOW_MS && !seen.includes(g.id)).map((g) => g.id);
    if (!ids.length || lapsedNote?.isConnected) return;
    const note = el('div', { class: 'friend-note friend-lapsed' },
      el('strong', {}, ids.length > 1 ? 'הזמנות ששלחת פגו' : 'הזמנה ששלחת פגה'),
      el('p', {}, ids.length > 1
        ? 'עבר שבוע ואף אחד לא הצטרף, אז הקישורים כבר לא פעילים. המקומות שלהן התפנו, ואפשר ליצור קישור חדש.'
        : 'עבר שבוע ואף אחד לא הצטרף, אז הקישור כבר לא פעיל. המקום שלה התפנה, ואפשר ליצור קישור חדש.'),
      el('button', { type: 'button', class: 'link', 'data-fid': 'lapsed-ok', onclick: () => { markLapsed(ids); note.remove(); } }, 'הבנתי'));
    lapsedNote = note;
    notes.append(note);
  };

  const inviteCard = (g: ListedGame): HTMLElement => {
    const cancel = el('button', { type: 'button', class: 'link' }, 'ביטול ההזמנה') as HTMLButtonElement;
    cancel.addEventListener('click', async () => {
      cancel.disabled = true;
      await api.cancel(g.code);
      void load();
    });
    return el('section', { class: 'friend-card friend-made' },
      el('h2', {}, g.code === fresh ? 'הקישור מוכן' : 'הזמנה שמחכה לחבר'),
      el('p', {}, `${SPEED_TEXT(g.speed, g.days, g.clock)}.`),
      shareRow(g.code),
      el('p', { class: 'friend-wait-line' }, waitLine('מחכים שהחבר יצטרף')),
      el('p', { class: 'small muted' }, 'כשהחבר יצטרף, המשחק יופיע כאן, ואפשר יהיה להיכנס אליו. הקישור טוב לשבוע ולמשחק אחד.'),
      cancel);
  };

  const createBtn = el('button', { type: 'button', class: 'btn' }, 'יצירת קישור הזמנה') as HTMLButtonElement;
  createBtn.addEventListener('click', async () => {
    createBtn.disabled = true;
    msg.textContent = '';
    const r = await api.create({ speed: 'corr', days: CORR_DAYS[0], color });
    if (!r.ok) {
      createBtn.disabled = false;
      msg.replaceChildren(errText(r.error), ' ', r.error === 'nickname' ? el('a', { href: '/account/' }, 'לעמוד החשבון') : r.error === 'full' ? '' : bugLink());
      if (r.error === 'full') void load();
      return;
    }
    fresh = r.data.code;
    adding = false;
    await load();
    createBtn.disabled = false;
  });
  const sides = el('div', { class: 'seg friend-seg', role: 'group' });
  for (const c of ['random', 'sente', 'gote'] as const) {
    sides.append(el('button', {
      type: 'button', 'aria-pressed': String(c === color),
      onclick: (e: Event) => {
        color = c;
        sides.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget)));
      },
    }, COLOR_TEXT[c]));
  }
  const form = [
    el('h2', {}, 'הזמנת חבר למשחק'),
    el('p', {}, NO_CLOCK),
    createBtn,
    msg,
    el('details', { class: 'friend-more' },
      el('summary', {}, 'אפשרויות נוספות'),
      el('div', { class: 'friend-field' },
        el('p', { class: 'friend-label' }, 'באיזה צד ⟦תשחק|תשחקי⟧?'),
        sides,
        el('p', { class: 'small muted' }, 'הפותח (☗) משחק ראשון.')),
      restField()),
  ];

  let editing: string | null = null;
  const rows = () => games.filter((g) => g.status === 'active' || (g.status !== 'open' && Date.now() - Date.parse(g.updatedAt) < 7 * 864e5))
    .sort((a, b) => Number(b.status === 'active') - Number(a.status === 'active'));
  const naming: Naming = {
    editing: null,
    open: (id) => { editing = id; drawList(); },
    close: () => { editing = null; drawList(); },
    save: async (g, label) => {
      const r = await api.label(g.id, label);
      if (!r.ok) return false;
      g.label = r.data.label;
      editing = null;
      drawList();
      return true;
    },
  };
  const drawList = () => {
    const shownRows = rows();
    naming.editing = editing;
    list.hidden = !shownRows.length;
    list.replaceChildren(...shownRows.slice(0, 12).map((g) => gameRow(g, naming)));
  };
  const draw = () => {
    const open = waiting();
    const used = open.length + running().length;
    const waitKey = open.map((g) => g.code).join(' ') + fresh;
    if (waitKey !== shown.wait) waitBox.replaceChildren(...open.map(inviteCard));
    const makeKey = !loaded ? 'load' : used >= MAX_SLOTS ? 'full' : open.length && !adding ? 'more' : 'form';
    if (makeKey !== shown.make) {
      if (makeKey === 'full') {
        makeBox.replaceChildren(
          el('h2', {}, 'שני המקומות שלך תפוסים'),
          el('p', {}, 'אפשר לשחק עד 2 משחקים עם חברים בו זמנית. גם הזמנה שמחכה לחבר תופסת מקום. המקום מתפנה כשמשחק נגמר, או כשמבטלים הזמנה.'));
      } else if (makeKey === 'more') {
        makeBox.replaceChildren(
          el('p', {}, 'נשאר לך מקום למשחק נוסף.'),
          el('button', { type: 'button', class: 'link', onclick: () => { adding = true; draw(); } }, 'הזמנה נוספת'));
      } else if (makeKey === 'form') {
        makeBox.replaceChildren(...form);
      }
    }
    shown = { wait: waitKey, make: makeKey };
    listBox.hidden = !rows().length && !used;
    if (!editing) drawList();
    places.textContent = `מקומות תפוסים: ${used} מתוך ${MAX_SLOTS}. משחק שרץ והזמנה שמחכה לחבר תופסים מקום.`;
    const done = games.filter((g) => g.status === 'finished' && g.you);
    const won = done.filter((g) => g.winner === g.you).length;
    const even = done.filter((g) => !g.winner).length;
    stats.hidden = !done.length;
    stats.replaceChildren(el('strong', {}, 'התוצאות שלך: '), `ניצחונות ${won} · הפסדים ${done.length - won - even} · תיקו ${even}`);
  };

  let loading = false;
  const load = async () => {
    if (loading) return;
    loading = true;
    const r = await api.mine();
    loading = false;
    if (!r.ok) {
      if (!loaded) makeBox.replaceChildren(el('p', {}, errText(r.error), ' ', bugLink()));
      return;
    }
    const before = new Set(waiting().map((g) => g.id));
    games = r.data.games;
    loaded = true;
    for (const g of games) if (before.has(g.id) && g.status === 'active') notes.prepend(started(g));
    lapsed();
    draw();
    void watch();
  };

  const guestList = el('ul', { class: 'friend-list' });
  const guestBox = el('section', { class: 'friend-card', hidden: true },
    el('h2', {}, 'משחקים ששיחקת כאן בלי חשבון'),
    el('p', { class: 'small muted' }, 'הם שמורים רק בדפדפן הזה. כדי לצרף משחק לחשבון: פותחים את המשחק, לוחצים על "עוד" ואז על "שמירת המשחק שלי".'),
    guestList);
  root.replaceChildren(notes, waitBox, makeBox, listBox, guestBox);
  void load().then(() => deviceGames(guestBox, guestList, (id) => games.some((g) => g.id === id && !!g.you)));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void load(); });
  window.setInterval(() => { if (document.visibilityState === 'visible' && waiting().length) void load(); }, POLL_MS);
}

async function invitePage(root: HTMLElement, code: string, me: boolean): Promise<void> {
  root.replaceChildren(el('section', { class: 'friend-card' }, el('p', {}, 'טוענים את ההזמנה…')));
  const r = await api.invite(code);
  const card = (...kids: (HTMLElement | string | null)[]) => root.replaceChildren(el('section', { class: 'friend-card friend-invite' }, ...kids));
  const home = el('a', { href: '/friend/', class: 'btn btn-ghost', onclick: () => remember(null) }, 'לעמוד המשחק עם חבר');
  if (!r.ok) {
    remember(null);
    return card(el('h2', {}, r.status === 404 ? 'ההזמנה לא נמצאה' : 'לא הצלחנו לטעון את ההזמנה'),
      el('p', {}, r.status === 404 ? 'כדאי לבדוק שהקישור הועתק במלואו.' : errText(r.error)), home);
  }
  const inv: InviteInfo = r.data;
  const what = SPEED_TEXT(inv.speed, inv.days, inv.clock);
  const yourSide = inv.color === 'random' ? 'הצדדים יוגרלו ⟦כשתצטרף|כשתצטרפי⟧' : `הצד שלך: ${COLOR_TEXT[inv.color === 'sente' ? 'gote' : 'sente']}`;
  if (inv.state === 'player' && inv.id) { remember(null); location.replace(gameUrl(inv.id)); return; }
  if (inv.state === 'mine') {
    remember(null);
    return card(el('h2', {}, 'זו ההזמנה שלך'), el('p', {}, `${what}. מחכים שהחבר יצטרף.`), shareRow(code), home);
  }
  if (inv.state !== 'open') {
    remember(null);
    const text = ({ taken: 'מישהו כבר הצטרף למשחק הזה. כל קישור הוא למשחק אחד.', expired: 'עבר שבוע וההזמנה פגה.', cancelled: 'מי שהזמין ביטל את ההזמנה.' } as Record<string, string>)[inv.state] ?? '';
    return card(el('h2', {}, 'ההזמנה כבר לא פתוחה'), el('p', {}, text), el('p', {}, `אפשר לבקש ${pre('מ', inv.inviter)}`, el('strong', {}, el('bdi', {}, inv.inviter)), ' קישור חדש.'), home);
  }
  const msg = el('p', { class: 'friend-msg', role: 'status' });
  const nameInput = el('input', {
    type: 'text', id: 'friend-name', maxlength: String(NAME_MAX), autocomplete: 'nickname', enterkeyhint: 'go', dir: 'auto',
    'aria-describedby': 'friend-name-hint', value: savedName(),
  }) as HTMLInputElement;
  const nameMsg = el('p', { class: 'friend-name__err', role: 'alert' });
  const nameField = me ? null : el('div', { class: 'friend-field friend-name' },
    el('label', { class: 'friend-label', for: 'friend-name' }, 'איך לקרוא לך במשחק?'),
    nameInput,
    nameMsg,
    el('p', { class: 'small muted', id: 'friend-name-hint' }, 'החבר יראה את השם. אפשר בעברית או באנגלית.'));
  const badName = (problem: NameProblem) => {
    nameMsg.textContent = NAME_ERR[problem];
    nameInput.setAttribute('aria-invalid', 'true');
    nameInput.focus();
  };
  nameInput.addEventListener('input', () => { nameInput.removeAttribute('aria-invalid'); nameMsg.textContent = ''; });
  const join = async (btn: HTMLButtonElement) => {
    msg.textContent = '';
    nameMsg.textContent = '';
    const name = me ? undefined : tidyName(nameInput.value);
    if (name !== undefined) {
      const problem = nameProblem(name);
      if (problem) return badName(problem);
      nameInput.value = name;
      saveName(name);
    }
    btn.disabled = true;
    const j = await api.join(code, name);
    if (j.ok && j.data.id) { remember(null); location.assign(gameUrl(j.data.id)); return; }
    btn.disabled = false;
    if (j.error?.startsWith('name-')) badName((j.error.slice(5) in NAME_ERR ? j.error.slice(5) : 'blocked') as NameProblem);
    else if (j.error === 'taken') msg.textContent = 'מישהו כבר הצטרף למשחק הזה.';
    else msg.replaceChildren(errText(j.error), ' ', j.error === 'full' ? el('a', { href: '/friend/', onclick: () => remember(null) }, 'למשחקים שלי') : bugLink());
  };
  const joinBtn = (label: string, ghost = false) => {
    const b = el('button', { type: 'button', class: ghost ? 'btn btn-ghost' : 'btn' }, label) as HTMLButtonElement;
    b.addEventListener('click', () => void join(b));
    return b;
  };
  const playNow = joinBtn(me ? '⟦בוא|בואי⟧ נשחק' : 'לשחק עכשיו, בלי הרשמה');
  nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !playNow.disabled) { e.preventDefault(); void join(playNow); } });
  card(
    el('p', { class: 'friend-kicker' }, 'הזמנה למשחק שוגי'),
    el('h2', {}, `הזמנה ${pre('מ', inv.inviter)}`, el('bdi', {}, inv.inviter), ' למשחק'),
    el('ul', { class: 'friend-facts' },
      el('li', {}, what),
      el('li', {}, yourSide),
      el('li', {}, 'אין צ׳אט: רק הודעות קבועות כמו "בהצלחה!".')),
    !me && isInApp() ? inAppNote(code) : null,
    nameField,
    inv.speed === 'corr' ? restField() : null,
    me
      ? playNow
      : el('div', { class: 'friend-actions' },
        playNow,
        accountsEnabled ? el('a', { class: 'btn btn-ghost', href: '/account/', onclick: () => remember(code) }, 'כניסה לחשבון ומשחק') : null),
    !me ? el('p', { class: 'small muted' }, 'בלי הרשמה המשחק נשמר רק במכשיר הזה. עם חשבון הוא נשמר בכל מכשיר. אחרי הכניסה לחשבון ⟦לחץ|לחצי⟧ שוב על הקישור שקיבלת.') : null,
    el('div', { class: 'friend-new' },
      el('strong', {}, 'אף פעם לא שיחקת שוגי?'),
      el('p', {}, 'משחק אחד קצר, מהלך אחרי מהלך, ⟦ואתה|ואת⟧ כבר ⟦יודע|יודעת⟧ מה קורה על הלוח. ההזמנה תחכה לך.'),
      el('a', { class: 'btn btn-ghost', href: '/try/', onclick: () => remember(code) }, 'קודם ללמוד, ואז לשחק')),
    msg,
  );
}
