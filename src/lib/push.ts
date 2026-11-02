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
const ONE_A_DAY_HOURS = 20;

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
  notices: Notice[];
  progressData?: unknown;
  lastSeen?: string | null;
}

export const isPublished = (n: { status?: string | null }): boolean => n.status == null || n.status === 'published';

export type PushDue = { kind: 'week' } | { kind: 'course' } | { kind: 'news'; notice: Notice };

export function duePush(row: PushRow, ctx: PushContext): PushDue | null {
  const { now } = ctx;
  const { weekday } = israelDay(now);
  if (weekday === 5 || weekday === 6) return null;
  const since = (iso: string | null | undefined) => (iso ? (now.getTime() - Date.parse(iso)) / DAY : Infinity);
  if (since(row.last_push_at) * 24 < ONE_A_DAY_HOURS) return null;

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
    const sent = row.course_at && ctx.lastSeen && Date.parse(ctx.lastSeen) > Date.parse(row.course_at) ? 0 : row.course_sent;
    const away = since(ctx.lastSeen);
    if (p.course.route && nextStep(p, LEVEL_COUNTS) && sent < COURSE_AFTER_DAYS.length && away >= COURSE_AFTER_DAYS[sent]) return { kind: 'course' };
  }
  return null;
}

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

export function afterPush(row: PushRow, due: PushDue, ctx: PushContext): Partial<PushRow> {
  const base = { last_push_at: ctx.now.toISOString() };
  if (due.kind === 'news') return { ...base, news_after: due.notice.starts_at };
  if (due.kind === 'week') return { ...base, week_sent: israelWeek(ctx.now) };
  const fresh = row.course_at && ctx.lastSeen && Date.parse(ctx.lastSeen) > Date.parse(row.course_at);
  return { ...base, course_sent: (fresh ? 0 : row.course_sent) + 1, course_at: ctx.now.toISOString() };
}

export const WELCOME: PushMessage = { title: 'ההתראות פועלות', body: 'מעכשיו נעדכן רק במה שבחרת. אפשר לשנות בכל רגע בהגדרות של האפליקציה.', url: '/app/#push', tag: 'welcome' };
