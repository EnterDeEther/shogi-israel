// Email nudges (opt-in only): who gets which email today, what it says, and the signed one-click unsubscribe links.
// Pure functions, shared by the email job (api/notify.ts), the unsubscribe page (api/unsubscribe.ts), the account
// settings and the sign-up form, and tested in test/notify.test.ts.
//
// The rules, from the plan Dean approved on 2026-10-25:
// - Nothing is sent unless the player turned that email on (חוק התקשורת, section 30A). Account emails are separate.
// - At most one nudge email in any 6 days, whatever its kind. Nothing on Friday or Saturday (Israel time).
// - The weekly email (puzzle of the week + next step on the path) goes out from Sunday evening; if the day's
//   sending limit runs out it may still go Monday to Thursday, never twice in one week. It is skipped when the
//   player already solved this week's puzzle and was on the site in the last 3 days.
// - "Come back" emails: after 14 days away, again after 45, then nothing until the next visit.
// .js on the imports: api/notify.ts runs this file on Node, where ESM needs the extension.
import { KIND_LABEL, nextStep, stepHref } from './curriculum.js';
import { LEVEL_COUNTS } from './level-counts.js';
import { normalize } from './progress-sync.js';
import { weekIndex, weekPuzzle, weekStreak, weeksHe, WEEK_LENGTH } from '../tsume/week.js';

export { CONSENT_TEXT, CONSENT_VERSION } from './consent.js';

export type EmailKind = 'week' | 'return';
export const SITE = 'https://shogi.co.il';
export const FROM = 'דין משוגי ישראל <noreply@shogi.co.il>'; // personal, from Dean (Godin rule)
export const REPLY_TO = 'contact@shogi.co.il';

const DAY = 24 * 60 * 60 * 1000;
export const CAP_DAYS = 6;
export const RETURN_AFTER_DAYS = [14, 45];
const RECENT_VISIT_DAYS = 3;

export interface PrefsRow {
  user_id: string;
  email_week: boolean;
  email_return: boolean;
  paused_reason: string | null;
  last_seen_at: string | null;
  return_sent: number;
  last_email_at: string | null;
}

/** Day of the week (0 = Sunday) and the date in Israel, whatever the server's time zone. */
export function israelDay(now: Date): { weekday: number; ymd: string } {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jerusalem', weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
  return { weekday, ymd: `${get('year')}-${get('month')}-${get('day')}` };
}

/** The week number of the puzzle of the week, as Israel sees it (src/tsume/week.ts counts in the visitor's time). */
export function israelWeek(now: Date): number {
  const { ymd } = israelDay(now);
  const [y, m, d] = ymd.split('-').map(Number);
  return weekIndex(new Date(y, m - 1, d, 12));
}

/** Which email (if any) this player gets today. `lastActive` falls back to the progress save time. */
export function dueEmail(row: PrefsRow, progressData: unknown, now: Date, weekCount: number, progressUpdatedAt?: string | null): EmailKind | null {
  if (row.paused_reason) return null;
  const { weekday } = israelDay(now);
  if (weekday === 5 || weekday === 6) return null; // Friday, Saturday
  const since = (iso: string | null | undefined) => (iso ? (now.getTime() - Date.parse(iso)) / DAY : Infinity);
  if (since(row.last_email_at) < CAP_DAYS) return null;

  const away = Math.min(since(row.last_seen_at), since(progressUpdatedAt));
  if (row.email_return && row.return_sent < RETURN_AFTER_DAYS.length && away >= RETURN_AFTER_DAYS[row.return_sent]) return 'return';

  // Sunday to Thursday; the 6-day cap above already keeps it to one a week
  if (row.email_week && weekday <= 4) {
    const p = normalize(progressData);
    const solved = (p.tsume[String(WEEK_LENGTH)] ?? []).includes(weekPuzzle(israelWeek(now), weekCount));
    if (solved && away < RECENT_VISIT_DAYS) return null;
    return 'week';
  }
  return null;
}

// ---------- the emails ----------

export interface EmailInput {
  kind: EmailKind;
  nickname: string;
  progressData: unknown;
  weekCount: number;
  now: Date;
  /** "Come back" emails: which one (0 = after 14 days, 1 = after 45). */
  returnIndex?: number;
  unsubscribeUrl: string;
}

export interface Email { subject: string; html: string; text: string }

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const utm = (path: string, kind: EmailKind) => `${SITE}${path}${path.includes('?') ? '&' : '?'}utm_source=email&utm_medium=email&utm_campaign=${kind}`;

export function buildEmail(input: EmailInput): Email {
  const { kind, nickname, weekCount, now } = input;
  const p = normalize(input.progressData);
  const week = israelWeek(now);
  const solved = p.tsume[String(WEEK_LENGTH)] ?? [];
  const streak = weekStreak(solved, weekCount, week);
  const next = p.course.track ? nextStep(p, LEVEL_COUNTS) : undefined;
  const nextLine = !p.course.track
    ? { text: 'עוד לא בחרת מאיפה להתחיל. שאלה אחת, ותקבל מסלול לימוד אישי.', href: '/course/', cta: 'למסלול הלימוד' }
    : next
      ? { text: `הצעד הבא במסלול שלך: ${next.step.title.replace(/^תרגול: /, '')} (${KIND_LABEL[next.step.kind]}, בערך ${next.step.minutes} דקות).`, href: stepHref(next.step, p, LEVEL_COUNTS), cta: 'לצעד הבא' }
      : { text: 'סיימת את כל המסלול! שחק נגד המחשב ברמה גבוהה יותר.', href: '/play/', cta: 'למשחק' };
  const puzzle = { text: streak > 0 ? `בעיית השבוע החדשה עלתה. פתרת ${weeksHe(streak)} ברצף: אל תשבור את הרצף.` : 'בעיית השבוע החדשה עלתה: מט בשלושה מהלכים.', href: `/tsume/${WEEK_LENGTH}/`, cta: 'לבעיית השבוע' };

  let subject: string;
  let blocks: { text: string; href: string; cta: string }[];
  let why: string;
  if (kind === 'week') {
    subject = 'בעיית השבוע: מט בשלושה מהלכים';
    blocks = [puzzle, nextLine];
    why = 'קיבלת את המייל כי ביקשת לקבל מאיתנו את בעיית השבוע במייל.';
  } else if ((input.returnIndex ?? 0) === 0) {
    subject = next ? `המסלול שלך מחכה: ${next.step.title.replace(/^תרגול: /, '')}` : 'הלוח מחכה לך';
    blocks = [{ ...nextLine, text: `עבר קצת זמן מאז הביקור האחרון. ${nextLine.text}` }, puzzle];
    why = 'קיבלת את המייל כי ביקשת תזכורת כשלא ביקרת באתר זמן מה.';
  } else {
    subject = 'הלוח מחכה לך';
    blocks = [{ text: 'רק מזכיר: ההתקדמות שלך שמורה, ואפשר להמשיך בדיוק מאיפה שעצרת.', href: nextLine.href, cta: 'המשך' }, puzzle];
    why = 'קיבלת את המייל כי ביקשת תזכורת כשלא ביקרת באתר זמן מה. זו התזכורת האחרונה עד הביקור הבא שלך.';
  }

  const hello = `שלום ${nickname},`;
  const signoff = ['נתראה על הלוח,', 'דין, שוגי ישראל', 'אפשר פשוט להשיב למייל הזה.'];
  const settings = `${SITE}/account/#notifications`;
  const footer = `${why} הטקסטים מנוסחים בלשון זכר מטעמי נוחות אך פונים לשני המינים. שוגי ישראל, shogi.co.il, ${REPLY_TO}`;
  const html = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#F6F0E4;">
<div style="direction:rtl;text-align:right;max-width:560px;margin:0 auto;padding:24px 20px;font-family:Arial,Helvetica,sans-serif;font-size:17px;line-height:1.6;color:#1E1A14;">
<p style="margin:0 0 16px;font-weight:bold;color:#B8361F;">将棋 שוגי ישראל</p>
<p style="margin:0 0 16px;">${esc(hello)}</p>
${blocks.map((b) => `<p style="margin:0 0 10px;">${esc(b.text)}</p>
<p style="margin:0 0 22px;"><a href="${esc(utm(b.href, kind))}" style="display:inline-block;background:#B8361F;color:#FFFFFF;text-decoration:none;font-weight:bold;padding:10px 18px;border-radius:6px;">${esc(b.cta)}</a></p>`).join('\n')}
<p style="margin:0 0 4px;">${signoff.slice(0, 2).map(esc).join('<br>')}</p>
<p style="margin:0;font-size:15px;color:#6B6256;">${esc(signoff[2])}</p>
<hr style="border:0;border-top:1px solid #D9CDB5;margin:24px 0 12px;">
<p style="margin:0;font-size:13px;color:#6B6256;">${esc(footer)}<br><a href="${esc(input.unsubscribeUrl)}" style="color:#6B6256;">הפסקת המיילים האלה</a> · <a href="${esc(settings)}" style="color:#6B6256;">הגדרות התראות</a></p>
</div></body></html>`;
  const text = [hello, '', ...blocks.flatMap((b) => [b.text, `${b.cta}: ${utm(b.href, kind)}`, '']), ...signoff, '', '--', footer, `הפסקת המיילים האלה: ${input.unsubscribeUrl}`, `הגדרות התראות: ${settings}`].join('\n');
  return { subject, html, text };
}

// ---------- signed unsubscribe links (no sign-in needed) ----------

const b64url = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function hmac(secret: string, msg: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(`unsubscribe:${secret}`), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg))).slice(0, 32);
}

export type UnsubKind = EmailKind | 'all';
export async function unsubscribeToken(secret: string, userId: string, kind: UnsubKind): Promise<string> {
  return hmac(secret, `${userId}:${kind}`);
}
export async function unsubscribeUrl(secret: string, userId: string, kind: EmailKind): Promise<string> {
  return `${SITE}/api/unsubscribe?u=${encodeURIComponent(userId)}&k=${kind}&t=${await unsubscribeToken(secret, userId, kind)}`;
}
export async function checkUnsubscribe(secret: string, userId: string, kind: string, token: string): Promise<boolean> {
  if (!/^[0-9a-f-]{36}$/.test(userId) || !['week', 'return', 'all'].includes(kind) || token.length !== 32) return false;
  const want = await unsubscribeToken(secret, userId, kind as UnsubKind);
  let diff = 0;
  for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ token.charCodeAt(i);
  return diff === 0;
}
