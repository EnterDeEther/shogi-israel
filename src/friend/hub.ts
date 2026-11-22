// AGPL-3.0-or-later, like the rest of this site.
import { el } from '../learn/view';
import { accountsEnabled } from '../lib/account-config';
import { isAndroid, isInApp } from '../lib/install';
import { copyText } from '../lib/kif';
import { api, gameUrl, type InviteInfo, inviteUrl, type ListedGame, readSeats, rememberedInvite, rememberInvite, SHORT_SPEED, signedIn, SPEED_TEXT } from './client';
import { CORR_DAYS, LIVE_CLOCKS } from './core';

const COLOR_TEXT: Record<Color | 'random', string> = { random: 'הגרלה', sente: 'פותח (☗)', gote: 'משיב (☖)' };

type Choice = { speed: 'corr'; days: number } | { speed: 'live'; clock: { limit: number; byo: number } };
const NO_CLOCK = 'בלי שעון: לכל מהלך יש עד 3 ימים, וכל אחד משחק מתי שנוח לו. סוף הזמן אף פעם לא נופל בשבת.';
const CHOICES: { key: string; label: string; hint: string; value: Choice }[] = [
  { key: 'corr', label: 'בלי שעון', hint: NO_CLOCK, value: { speed: 'corr', days: CORR_DAYS[0] } },
  ...LIVE_CLOCKS.map((c) => ({ key: `live${c.limit}`, label: `${c.limit / 60} דק׳ + ${c.byo} שנ׳`, hint: 'משחק חי עם שעון: שניכם מול המסך באותו זמן.', value: { speed: 'live' as const, clock: c } })),
];

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
  'too-many': 'יש לך כבר 5 הזמנות פתוחות. אפשר לבטל אחת מהן ולנסות שוב.',
  'sign-in': 'צריך להיכנס לחשבון כדי להזמין.',
  network: 'אין חיבור לרשת כרגע. כדאי לנסות שוב בעוד רגע.',
  paused: 'המשחק עם חבר בהפסקה קצרה. המשחקים שמורים, ונחזור בקרוב.',
};
const errText = (e?: string) => (e && ERR[e]) || 'משהו השתבש. כדאי לנסות שוב.';

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

function gameRow(g: ListedGame, onCancel: (code: string) => void): HTMLElement {
  const opp = g.you ? g.names[g.you === 'sente' ? 'gote' : 'sente'] : '';
  const what = SHORT_SPEED(g.speed, g.days, g.clock);
  if (g.status === 'open') {
    return el('li', { class: 'friend-row' },
      el('div', { class: 'friend-row__main' },
        el('strong', {}, 'מחכה לחבר'),
        el('span', { class: 'small muted' }, what)),
      el('div', { class: 'friend-row__side' },
        el('button', { type: 'button', class: 'link', onclick: () => void copyText(inviteUrl(g.code)) }, 'העתקת קישור'),
        el('button', { type: 'button', class: 'link', onclick: () => onCancel(g.code) }, 'ביטול')),
    );
  }
  const result = g.status === 'active'
    ? (g.yourTurn ? 'תורך' : `התור של ${opp}`)
    : g.endReason === 'abort' || g.status === 'aborted' ? 'בוטל'
      : !g.winner ? 'תיקו' : g.winner === g.you ? 'ניצחת' : 'הפסד';
  return el('li', { class: `friend-row${g.yourTurn ? ' turn' : ''}` },
    el('a', { href: gameUrl(g.id), class: 'friend-row__main' },
      el('strong', {}, `נגד ${opp}`),
      el('span', { class: 'small muted' }, `${what} · ${g.ply} מהלכים`)),
    el('span', { class: `friend-tag${g.yourTurn ? ' hot' : ''}` }, result),
  );
}

export async function bootHub(root: HTMLElement): Promise<void> {
  const me = await signedIn();
  const hashCode = codeFromHash();
  const code = hashCode ?? (me ? remembered() : null);
  if (code) return invitePage(root, code, me);
  remember(null);
  return me ? homeSignedIn(root) : homeGuest(root);
}

function homeGuest(root: HTMLElement): void {
  const seats = Object.keys(readSeats()).slice(-5).reverse();
  const list = el('ul', { class: 'friend-list' });
  const box = el('section', { class: 'friend-card', hidden: true }, el('h2', {}, 'המשחקים שלך במכשיר הזה'), list);
  root.replaceChildren(
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
  if (!seats.length) return;
  void Promise.all(seats.map((id) => api.state(id))).then((rs) => {
    const games = rs.flatMap((r) => (r.ok ? [r.data.game] : []));
    if (!games.length) return;
    box.hidden = false;
    list.append(...games.map((g) => {
      const opp = g.names[g.you === 'sente' ? 'gote' : 'sente'];
      const yourTurn = g.status === 'active' && (g.ply % 2 === 0 ? 'sente' : 'gote') === g.you;
      return el('li', { class: `friend-row${yourTurn ? ' turn' : ''}` },
        el('a', { href: gameUrl(g.id), class: 'friend-row__main' }, el('strong', {}, `נגד ${opp}`), el('span', { class: 'small muted' }, `${g.ply} מהלכים`)),
        el('span', { class: `friend-tag${yourTurn ? ' hot' : ''}` }, g.status === 'active' ? (yourTurn ? 'תורך' : `התור של ${opp}`) : 'הסתיים'));
    }));
  });
}

function homeSignedIn(root: HTMLElement): void {
  let pick = CHOICES[0];
  let color: Color | 'random' = 'random';
  const msg = el('p', { class: 'friend-msg', role: 'status' });
  const made = el('section', { class: 'friend-card friend-made', hidden: true });
  const list = el('ul', { class: 'friend-list' });
  const listBox = el('section', { class: 'friend-card', hidden: true }, el('h2', {}, 'המשחקים שלך'), list,
    el('p', { class: 'small' }, el('a', { href: '/games/' }, 'כל המשחקים שלי, עם צפייה חוזרת וקובץ KIF')));
  const hint = el('p', { class: 'small muted' }, pick.hint);
  const seg = <T>(items: { key: string; label: string; value: T }[], on: (v: T) => void, current: string) => {
    const s = el('div', { class: 'seg friend-seg', role: 'group' });
    for (const it of items) {
      s.append(el('button', {
        type: 'button', 'aria-pressed': String(it.key === current),
        onclick: (e: Event) => {
          s.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget)));
          on(it.value);
        },
      }, it.label));
    }
    return s;
  };
  const createBtn = el('button', { type: 'button', class: 'btn' }, 'יצירת קישור הזמנה');
  let stopWatch = () => {};
  const watch = async (id: string) => {
    stopWatch();
    const { supabase } = await import('../lib/account');
    const ch = supabase().channel(`fg:${id}`).on('broadcast', { event: 'changed' }, () => location.assign(gameUrl(id))).subscribe();
    stopWatch = () => { void supabase().removeChannel(ch); };
  };
  createBtn.addEventListener('click', async () => {
    createBtn.disabled = true;
    msg.textContent = '';
    const body = pick.value.speed === 'corr' ? { speed: 'corr', days: pick.value.days, color } : { speed: 'live', clock: pick.value.clock, color };
    const r = await api.create(body);
    createBtn.disabled = false;
    if (!r.ok) {
      msg.replaceChildren(errText(r.error), ' ', r.error === 'nickname' ? el('a', { href: '/account/' }, 'לעמוד החשבון') : '');
      return;
    }
    made.hidden = false;
    made.replaceChildren(
      el('h2', {}, 'הקישור מוכן'),
      el('p', {}, `${SPEED_TEXT(pick.value.speed, pick.value.speed === 'corr' ? pick.value.days : null, pick.value.speed === 'live' ? pick.value.clock : null)}. הצד שלך: ${COLOR_TEXT[color]}.`),
      shareRow(r.data.code),
      el('p', { class: 'small muted' }, 'כשהחבר יצטרף, המשחק ייפתח כאן מעצמו. הקישור טוב לשבוע ולמשחק אחד.'),
    );
    made.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    void watch(r.data.id);
    void loadList();
  });
  const loadList = async () => {
    const r = await api.mine();
    if (!r.ok) return;
    const games = r.data.games.filter((g) => g.status === 'open' || g.status === 'active' || Date.now() - Date.parse(g.updatedAt) < 7 * 864e5);
    listBox.hidden = !games.length;
    list.replaceChildren(...games.slice(0, 12).map((g) => gameRow(g, async (c) => {
      await api.cancel(c);
      void loadList();
    })));
  };
  root.replaceChildren(
    el('section', { class: 'friend-card' },
      el('h2', {}, 'הזמנת חבר למשחק'),
      el('p', {}, 'משחק אחד, בלי שעון. לכל מהלך יש עד 3 ימים, וכל אחד משחק מתי שנוח לו.'),
      createBtn,
      msg,
      el('details', { class: 'friend-more' },
        el('summary', {}, 'אפשרויות נוספות'),
        el('div', { class: 'friend-field' },
          el('p', { class: 'friend-label' }, 'עם שעון או בלי?'),
          seg(CHOICES, (v) => { pick = CHOICES.find((c) => c.value === v)!; hint.textContent = pick.hint; }, pick.key),
          hint),
        el('div', { class: 'friend-field' },
          el('p', { class: 'friend-label' }, 'באיזה צד ⟦תשחק|תשחקי⟧?'),
          seg((['random', 'sente', 'gote'] as const).map((c) => ({ key: c, label: COLOR_TEXT[c], value: c })), (v) => { color = v; }, color),
          el('p', { class: 'small muted' }, 'הפותח (☗) משחק ראשון.'))),
    ),
    made,
    listBox,
  );
  void loadList();
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void loadList(); });
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
    return card(el('h2', {}, 'ההזמנה כבר לא פתוחה'), el('p', {}, text), el('p', {}, 'אפשר לבקש מ', el('strong', {}, inv.inviter), ' קישור חדש.'), home);
  }
  const msg = el('p', { class: 'friend-msg', role: 'status' });
  const join = async (btn: HTMLButtonElement) => {
    btn.disabled = true;
    msg.textContent = '';
    const j = await api.join(code);
    if (j.ok && j.data.id) { remember(null); location.assign(gameUrl(j.data.id)); return; }
    btn.disabled = false;
    msg.textContent = j.error === 'taken' ? 'מישהו כבר הצטרף למשחק הזה.' : errText(j.error);
  };
  const joinBtn = (label: string, ghost = false) => {
    const b = el('button', { type: 'button', class: ghost ? 'btn btn-ghost' : 'btn' }, label) as HTMLButtonElement;
    b.addEventListener('click', () => void join(b));
    return b;
  };
  card(
    el('p', { class: 'friend-kicker' }, 'הזמנה למשחק שוגי'),
    el('h2', {}, 'הזמנה מ', el('bdi', {}, inv.inviter), ' למשחק'),
    el('ul', { class: 'friend-facts' },
      el('li', {}, what),
      el('li', {}, yourSide),
      el('li', {}, 'אין צ׳אט: רק הודעות קבועות כמו "בהצלחה!".')),
    !me && isInApp() ? inAppNote(code) : null,
    me
      ? joinBtn('⟦בוא|בואי⟧ נשחק')
      : el('div', { class: 'friend-actions' },
        joinBtn('לשחק עכשיו, בלי הרשמה'),
        accountsEnabled ? el('a', { class: 'btn btn-ghost', href: '/account/', onclick: () => remember(code) }, 'כניסה לחשבון ומשחק') : null),
    !me ? el('p', { class: 'small muted' }, 'בלי הרשמה המשחק נשמר רק במכשיר הזה. עם חשבון הוא נשמר בכל מכשיר. אחרי הכניסה לחשבון ⟦לחץ|לחצי⟧ שוב על הקישור שקיבלת.') : null,
    el('div', { class: 'friend-new' },
      el('strong', {}, 'אף פעם לא שיחקת שוגי?'),
      el('p', {}, 'משחק אחד קצר, מהלך אחרי מהלך, ⟦ואתה|ואת⟧ כבר ⟦יודע|יודעת⟧ מה קורה על הלוח. ההזמנה מחכה לך.'),
      el('a', { class: 'btn btn-ghost', href: '/try/', onclick: () => remember(code) }, 'קודם ללמוד, ואז לשחק')),
    msg,
  );
}
