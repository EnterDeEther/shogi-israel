// Progress that follows a signed-in account: the Learn scores and the Rules lessons marked done.
// Pure functions only (tested in test/progress-sync.test.ts); src/lib/account.ts does the I/O.

export interface LearnProgress { stages: Record<string, { scores: number[] }> }
export interface SyncedProgress { learn: LearnProgress; rules: string[] }

export const LEARN_KEY = 'shogi-il.learn.progress';
export const RULES_PREFIX = 'done:';

export const emptyProgress = (): SyncedProgress => ({ learn: { stages: {} }, rules: [] });

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
  if (Array.isArray(r.rules)) out.rules = [...new Set(r.rules.filter((s: unknown): s is string => typeof s === 'string'))].sort();
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
