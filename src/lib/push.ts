// Push notifications on the phone (opt-in, only inside the installed app): the kinds, who gets which one today,
// and what it says. Pure functions, shared by the settings (src/lib/push-client.ts), /api/push, the daily job
// (src/lib/push-send.ts, run from api/notify.ts) and test/push.test.ts.
//
// The rules (proposed to Dean on 2026-10-29):
// - Every kind is off until the player turns it on in the app. Turning them all off removes the phone from the list.
// - At most one push a day, and nothing on Friday or Saturday (Israel time), like the emails.
// - Puzzle of the week: on Sunday evening, when the new one is up. Skipped when a signed-in player already solved it.
// - Course reminder (signed in only, we need the progress): after 3 days away, then 7, then 14, then quiet until the next visit.
// - News: when a new notice goes live (the `notices` table, the same news as the bell), once.
// .js on the imports: the Vercel functions run this file on Node, where ESM needs the extension.
import { nextStep, stepHref } from './curriculum.js';
import { LEVEL_COUNTS } from './level-counts.js';
import { normalize } from './progress-sync.js';
import { resolve, type Gender } from './gender.js';
import { israelDay, israelWeek } from './notify.js';
import { weekPuzzle, weekStreak, weeksHe, WEEK_LENGTH } from '../tsume/week.js';

export type PushKind = 'week' | 'course' | 'news';
export const PUSH_KINDS: PushKind[] = ['week', 'course', 'news'];
export type PushKinds = Record<PushKind, boolean>;

export const PUSH_LABEL: Record<PushKind, { title: string; sub: string }> = {
  week: { title: 'בעיית השבוע', sub: 'ביום ראשון בערב, כשעולה בעיה חדשה. פעם בשבוע.' },
  course: { title: 'תזכורת למסלול', sub: 'אחרי כמה ימים בלי לבקר: מה הצעד הבא שלך. שלוש פעמים לכל היותר, עד הביקור הבא.' },
  news: { title: 'חדשות שוגי ישראל', sub: 'דברים חדשים באתר ובקהילה. רק כשיש משהו באמת.' },
};

const DAY = 864e5;
export const COURSE_AFTER_DAYS = [3, 7, 14];
const ONE_A_DAY_HOURS = 20; // the job runs daily; a little slack so a late run doesn't skip a day

// The push services of the browsers that can install the app. Anything else is refused, so /api/push can't be
// used to make our server call arbitrary addresses.
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /^android\.googleapis\.com$/, /(^|\.)push\.apple\.com$/, /(^|\.)push\.services\.mozilla\.com$/, /\.notify\.windows\.com$/];
export function pushEndpointOk(endpoint: unknown): endpoint is string {
  if (typeof endpoint !== 'string' || endpoint.length > 1000) return false;
  try {
    const u = new URL(endpoint);
    return u.protocol === 'https:' && !u.port && PUSH_HOSTS.some((h) => h.test(u.hostname));
  } catch { return false; }
}

export interface PushRow {
  endpoint: string;
  user_id: string | null;
  gender: string;
  push_week: boolean;
  push_course: boolean;
  push_news: boolean;
  last_push_at: string | null;
  week_sent: number | null;
  course_sent: number;
  course_at: string | null;
  news_after: string;
}

export interface Notice { id: number; title: string; body: string | null; url: string | null; starts_at: string }

export interface PushContext {
  now: Date;
  weekCount: number;
  /** Live notices, newest first. */
  notices: Notice[];
  /** Signed-in players only: their saved progress and when they were last on the site. */
  progressData?: unknown;
  lastSeen?: string | null;
}

export type PushDue = { kind: 'week' } | { kind: 'course' } | { kind: 'news'; notice: Notice };

/** Which push (if any) this phone gets today. */
export function duePush(row: PushRow, ctx: PushContext): PushDue | null {
  const { now } = ctx;
  const { weekday } = israelDay(now);
  if (weekday === 5 || weekday === 6) return null; // Friday, Saturday
  const since = (iso: string | null | undefined) => (iso ? (now.getTime() - Date.parse(iso)) / DAY : Infinity);
  if (since(row.last_push_at) * 24 < ONE_A_DAY_HOURS) return null;

  // news first: it is rare and has a date
  if (row.push_news) {
    const fresh = ctx.notices.find((n) => Date.parse(n.starts_at) > Date.parse(row.news_after) && Date.parse(n.starts_at) <= now.getTime());
    if (fresh) return { kind: 'news', notice: fresh };
  }

  if (row.push_week && weekday === 0) {
    const week = israelWeek(now);
    if (row.week_sent !== week) {
      const solved = row.user_id ? (normalize(ctx.progressData).tsume[String(WEEK_LENGTH)] ?? []) : [];
      if (!solved.includes(weekPuzzle(week, ctx.weekCount))) return { kind: 'week' };
    }
  }

  if (row.push_course && row.user_id) {
    const p = normalize(ctx.progressData);
    // a visit since the last reminder starts the count again
    const sent = row.course_at && ctx.lastSeen && Date.parse(ctx.lastSeen) > Date.parse(row.course_at) ? 0 : row.course_sent;
    const away = since(ctx.lastSeen);
    if (p.course.route && nextStep(p, LEVEL_COUNTS) && sent < COURSE_AFTER_DAYS.length && away >= COURSE_AFTER_DAYS[sent]) return { kind: 'course' };
  }
  return null;
}

/** What the phone shows. `tag` makes a newer push of the same kind replace an older one. */
export interface PushMessage { title: string; body: string; url: string; tag: string }

export function buildPush(due: PushDue, ctx: PushContext, gender: Gender = 'm'): PushMessage {
  const p = normalize(ctx.progressData);
  let m: PushMessage;
  if (due.kind === 'news') {
    m = { title: due.notice.title, body: due.notice.body ?? 'יש משהו חדש בשוגי ישראל.', url: due.notice.url ?? '/', tag: `news-${due.notice.id}` };
  } else if (due.kind === 'week') {
    const streak = weekStreak(p.tsume[String(WEEK_LENGTH)] ?? [], ctx.weekCount, israelWeek(ctx.now));
    m = {
      title: 'בעיית השבוע החדשה עלתה',
      body: streak > 0 ? `מט בשלושה מהלכים. פתרת ${weeksHe(streak)} ברצף: אל ⟦תשבור|תשברי⟧ את הרצף.` : 'מט בשלושה מהלכים. ⟦תמצא|תמצאי⟧ אותו?',
      url: `/tsume/${WEEK_LENGTH}/`,
      tag: 'week',
    };
  } else {
    const next = nextStep(p, LEVEL_COUNTS);
    m = next
      ? { title: 'המסלול שלך מחכה', body: `הצעד הבא: ${next.step.title.replace(/^תרגול: /, '')}, בערך ${next.step.minutes} דקות.`, url: stepHref(next.step, p, LEVEL_COUNTS), tag: 'course' }
      : { title: 'הלוח מחכה לך', body: '⟦המשך|המשיכי⟧ בדיוק מאיפה שעצרת.', url: '/app/', tag: 'course' };
  }
  return { ...m, title: resolve(m.title, gender), body: resolve(m.body, gender) };
}

/** The row's fields to update after a push went out. */
export function afterPush(row: PushRow, due: PushDue, ctx: PushContext): Partial<PushRow> {
  const base = { last_push_at: ctx.now.toISOString() };
  if (due.kind === 'news') return { ...base, news_after: due.notice.starts_at };
  if (due.kind === 'week') return { ...base, week_sent: israelWeek(ctx.now) };
  const fresh = row.course_at && ctx.lastSeen && Date.parse(ctx.lastSeen) > Date.parse(row.course_at);
  return { ...base, course_sent: (fresh ? 0 : row.course_sent) + 1, course_at: ctx.now.toISOString() };
}

/** The first push, right after the player turns notifications on: proof that they work on this phone. */
export const WELCOME: PushMessage = { title: 'ההתראות פועלות', body: 'מעכשיו נעדכן רק במה שבחרת. אפשר לשנות בכל רגע בהגדרות של האפליקציה.', url: '/app/#push', tag: 'welcome' };
