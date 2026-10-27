// Progress that follows a signed-in account: the Learn scores, the Rules lessons marked done,
// the tsume puzzles solved, the guided course (/course/: route and starting level, steps read or skipped, games played),
// and the inbox (src/lib/inbox.ts: which notes were read, which kinds are turned off).
// Pure functions only (tested in test/progress-sync.test.ts); src/lib/progress-local.ts and src/lib/account.ts do the I/O.

export interface LearnProgress { stages: Record<string, { scores: number[] }> }
/** The course's two ways in: the main one, and the one for chess players (explanations by comparison with chess). */
export type Route = 'main' | 'chess';
/** The course's three levels; the starting level comes from the placement questions or a manual pick. */
export type CourseLevel = 'beginner' | 'intermediate' | 'advanced';
export interface CourseState {
  /** The answers to "where do you start?"; both null until chosen. Before 2026-10-27 this was one
   *  `track` ('new' | 'chess' | 'shogi'), read by normalize(): new → main/beginner, chess → chess/beginner,
   *  shogi (knows the rules) → main/intermediate. */
  route: Route | null;
  start: CourseLevel | null;
  /** When the starting point was chosen (ISO), so the newer choice wins when two devices disagree. */
  placedAt: string;
  /** Course steps opened from /course/ (reading steps count as done once opened). */
  seen: string[];
  /** Course steps the player marked as already known. */
  skipped: string[];
  /** Highest computer level with a finished game, and with a win (0 = none). */
  played: number;
  won: number;
}
/** Kinds of on-site notes, each one switch in the account's notification settings. */
export type InboxGroup = 'path' | 'week' | 'rank' | 'news';
export const INBOX_GROUPS: InboxGroup[] = ['path', 'week', 'rank', 'news'];
export interface InboxState {
  /** Ids of the notes already seen (src/lib/inbox.ts), newest last, at most INBOX_READ_MAX. */
  read: string[];
  /** Kinds turned off in the settings. */
  off: InboxGroup[];
  /** When the settings last changed (ISO), so the newer choice wins between devices. */
  offAt: string;
}
export const INBOX_READ_MAX = 200;

export interface SyncedProgress {
  learn: LearnProgress;
  rules: string[];
  /** Tsume puzzle numbers solved, per length ("1", "3", "5", "7"). */
  tsume: Record<string, number[]>;
  course: CourseState;
  inbox: InboxState;
}

export const LEARN_KEY = 'shogi-il.learn.progress';
export const RULES_PREFIX = 'done:';
export const TSUME_KEY = 'shogi-il.tsume.solved';
export const COURSE_KEY = 'shogi-il.course';
export const INBOX_KEY = 'shogi-il.inbox';
export const ROUTES: Route[] = ['main', 'chess'];
export const COURSE_LEVELS: CourseLevel[] = ['beginner', 'intermediate', 'advanced'];

export const emptyCourse = (): CourseState => ({ route: null, start: null, placedAt: '', seen: [], skipped: [], played: 0, won: 0 });
export const emptyInbox = (): InboxState => ({ read: [], off: [], offAt: '' });
export const emptyProgress = (): SyncedProgress => ({ learn: { stages: {} }, rules: [], tsume: {}, course: emptyCourse(), inbox: emptyInbox() });

const strings = (v: unknown): string[] =>
  Array.isArray(v) ? [...new Set(v.filter((s: unknown): s is string => typeof s === 'string'))].sort() : [];
const level = (v: unknown): number => (typeof v === 'number' && v >= 1 ? Math.min(10, Math.floor(v)) : 0);
const ids = (v: unknown): number[] =>
  Array.isArray(v) ? [...new Set(v.filter((n: unknown): n is number => Number.isInteger(n) && (n as number) > 0))].sort((a, b) => a - b) : [];

/** Coerce anything (old local data, a row from the server) into the expected shape. */
export function normalize(raw: unknown): SyncedProgress {
  const out = emptyProgress();
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, any>;
  const stages = r.learn?.stages;
  if (stages && typeof stages === 'object') {
    for (const [key, v] of Object.entries(stages as Record<string, any>)) {
      if (!Array.isArray(v?.scores)) continue;
      out.learn.stages[key] = { scores: v.scores.map((s: unknown) => (typeof s === 'number' && s > 0 ? Math.min(3, Math.floor(s)) : 0)) };
    }
  }
  out.rules = strings(r.rules);
  if (r.tsume && typeof r.tsume === 'object') {
    for (const [n, list] of Object.entries(r.tsume as Record<string, unknown>)) {
      const solved = ids(list);
      if (/^\d+$/.test(n) && solved.length) out.tsume[n] = solved;
    }
  }
  const c = (r.course && typeof r.course === 'object' ? r.course : {}) as Record<string, unknown>;
  // the old one-answer `track` (until 2026-10-27) maps onto a route and a starting level
  const legacy = ({ new: ['main', 'beginner'], chess: ['chess', 'beginner'], shogi: ['main', 'intermediate'] } as Record<string, [Route, CourseLevel]>)[c.track as string];
  const route = ROUTES.includes(c.route as Route) ? (c.route as Route) : legacy?.[0] ?? null;
  const start = COURSE_LEVELS.includes(c.start as CourseLevel) ? (c.start as CourseLevel) : legacy?.[1] ?? null;
  const placedAt = typeof c.placedAt === 'string' ? c.placedAt : typeof c.trackAt === 'string' ? c.trackAt : '';
  out.course = {
    route: route && start ? route : null,
    start: route && start ? start : null,
    placedAt,
    seen: strings(c.seen),
    skipped: strings(c.skipped),
    played: level(c.played),
    won: level(c.won),
  };
  if (!out.course.route) out.course.placedAt = '';
  const ib = (r.inbox && typeof r.inbox === 'object' ? r.inbox : {}) as Record<string, unknown>;
  const read = Array.isArray(ib.read) ? ib.read.filter((s: unknown): s is string => typeof s === 'string' && s.length <= 64) : [];
  out.inbox = {
    read: [...new Set(read)].slice(-INBOX_READ_MAX),
    off: INBOX_GROUPS.filter((g) => Array.isArray(ib.off) && ib.off.includes(g)),
    offAt: typeof ib.offAt === 'string' ? ib.offAt : '',
  };
  return out;
}

/** Union of both: the best score per level, every lesson done on either side. */
export function merge(a: SyncedProgress, b: SyncedProgress): SyncedProgress {
  const out = emptyProgress();
  for (const key of new Set([...Object.keys(a.learn.stages), ...Object.keys(b.learn.stages)])) {
    const x = a.learn.stages[key]?.scores ?? [];
    const y = b.learn.stages[key]?.scores ?? [];
    out.learn.stages[key] = { scores: Array.from({ length: Math.max(x.length, y.length) }, (_, i) => Math.max(x[i] ?? 0, y[i] ?? 0)) };
  }
  out.rules = [...new Set([...a.rules, ...b.rules])].sort();
  for (const n of new Set([...Object.keys(a.tsume), ...Object.keys(b.tsume)])) {
    out.tsume[n] = [...new Set([...(a.tsume[n] ?? []), ...(b.tsume[n] ?? [])])].sort((x, y) => x - y);
  }
  // the newer starting-point choice wins; everything else is a union / the best of both
  const pick = b.course.route && (!a.course.route || b.course.placedAt > a.course.placedAt) ? b.course : a.course;
  out.course = {
    route: pick.route,
    start: pick.start,
    placedAt: pick.placedAt,
    seen: [...new Set([...a.course.seen, ...b.course.seen])].sort(),
    skipped: [...new Set([...a.course.skipped, ...b.course.skipped])].sort(),
    played: Math.max(a.course.played, b.course.played),
    won: Math.max(a.course.won, b.course.won),
  };
  // read notes: both lists (keeping the order, newest last); settings: the newer change wins
  const settings = b.inbox.offAt > a.inbox.offAt ? b.inbox : a.inbox;
  out.inbox = {
    read: [...new Set([...a.inbox.read, ...b.inbox.read])].slice(-INBOX_READ_MAX),
    off: [...settings.off],
    offAt: settings.offAt,
  };
  return out;
}

export const same = (a: SyncedProgress, b: SyncedProgress) => JSON.stringify(a) === JSON.stringify(b);

export interface Stats {
  stars: number; maxStars: number;
  levelsDone: number; levels: number;
  stagesDone: number; stages: number;
  rulesDone: number;
}

/** levelCounts: stage key → number of levels (from src/learn/categories.ts at build time). */
export function stats(p: SyncedProgress, levelCounts: Record<string, number>): Stats {
  const s: Stats = { stars: 0, maxStars: 0, levelsDone: 0, levels: 0, stagesDone: 0, stages: 0, rulesDone: p.rules.length };
  for (const [key, n] of Object.entries(levelCounts)) {
    const scores = (p.learn.stages[key]?.scores ?? []).slice(0, n);
    const done = scores.filter((x) => x > 0).length;
    s.stages++;
    s.levels += n;
    s.maxStars += 3 * n;
    s.levelsDone += done;
    s.stars += scores.reduce((t, x) => t + (x > 0 ? x : 0), 0);
    if (done === n) s.stagesDone++;
  }
  return s;
}

/** Nickname rule, same as the check in supabase/migrations/0001_accounts.sql. */
export const NICKNAME_RE = /^[A-Za-z0-9\u05D0-\u05EA_-]{3,16}$/;
/** Same reserved words as the database check: staff-looking names are refused. */
export const RESERVED_RE = /(admin|moderator|support|shogi.?israel|official|staff|system|root|מנהל|הנהלה|שוגי.?ישראל|רשמי|צוות|תמיכה)/i;

/** A finished game against the computer, from the player's side. Under two moves counts as abandoned. */
export function gameResult(r: { moves: string[]; playerColor: string; result?: { winner?: string } }): 'win' | 'loss' | 'draw' | 'abort' {
  if (!r.result || r.moves.length < 2) return 'abort';
  if (!r.result.winner) return 'draw';
  return r.result.winner === r.playerColor ? 'win' : 'loss';
}
