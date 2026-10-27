// Points (נקודות) and ranks (דרגות) for the guided course. Everything is worked out from the progress the
// site already saves (src/lib/progress-sync.ts), so points follow the account and can't be counted twice.
// Ranks borrow the names of shogi ranks, קיו and דאן, from 15 קיו up; they measure progress on this site,
// not playing strength, and the page says so.
// Each thing pays once: points are counted from the set of things completed (best stars per level, puzzle
// numbers, lessons, the first finished game and first win per level), so replaying earns nothing.
// Pure functions (tested in test/xp.test.ts).
import { ALL_STEPS, CURRICULUM, isOptional, stepState, stepsFor, type Step } from './curriculum.js'; // .js: api/admin-report.ts runs this file on Node
import type { SyncedProgress } from './progress-sync.js';

export const XP = {
  star: 10, // per star in an interactive lesson level (1–3 stars)
  rules: 50, // a rules lesson finished
  read: 20, // a guide section opened from the course
  tsume: { 1: 5, 3: 15, 5: 30, 7: 50 } as Record<string, number>, // per puzzle solved
  played: 20, // first finished game at each computer level
  won: 40, // × the level, first win at each level
  step: 25, // a course step done
  unit: 100, // a whole unit (basics or a phase) done
};

export interface XpBreakdown { learn: number; rules: number; read: number; tsume: number; games: number; course: number; total: number }

export function xpBreakdown(p: SyncedProgress, levelCounts: Record<string, number>): XpBreakdown {
  let learn = 0;
  for (const [key, n] of Object.entries(levelCounts)) {
    for (const s of (p.learn.stages[key]?.scores ?? []).slice(0, n)) learn += Math.max(0, s) * XP.star;
  }
  const rules = p.rules.length * XP.rules;
  const read = ALL_STEPS.filter((s) => s.kind === 'read' && p.course.seen.includes(s.id)).length * XP.read;
  let tsume = 0;
  for (const [n, list] of Object.entries(p.tsume)) tsume += list.length * (XP.tsume[n] ?? 0);
  let games = p.course.played * XP.played;
  for (let l = 1; l <= p.course.won; l++) games += l * XP.won;
  // only steps actually done count: a step marked "already known" gives no points
  const done = ALL_STEPS.filter((s) => stepState(s, p, levelCounts) === 'done').length;
  // a unit counts once every required step in it is really done (skipped ones block the bonus; optional ones don't)
  const units = CURRICULUM.filter((u) => {
    const req = stepsFor(u, p.course).filter((s) => !isOptional(s, p.course));
    return req.length > 0 && req.every((s) => stepState(s, p, levelCounts) === 'done');
  }).length;
  const course = done * XP.step + units * XP.unit;
  return { learn, rules, read, tsume, games, course, total: learn + rules + read + tsume + games + course };
}

/** The most points a step can give when finished (its content plus the step bonus), for "עד +N" on /course/. */
export function stepXp(s: Step, levelCounts: Record<string, number>): number {
  const content = {
    try: 0, // a first-step page (/try/): only the step bonus
    rules: XP.rules,
    learn: (s.learn ?? []).reduce((t, k) => t + (levelCounts[k] ?? 0) * 3 * XP.star, 0),
    read: XP.read,
    tsume: (s.target ?? 1) * (XP.tsume[String(s.tsume)] ?? 0),
    play: s.win ? (s.play ?? 1) * XP.won : XP.played,
  }[s.kind];
  return content + XP.step;
}

export interface Rank { index: number; name: string; kanji: string; min: number }

const KANJI = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三', '十四', '十五'];
// points needed for each rank, from 15 קיו to 5 דאן
const THRESHOLDS = [0, 60, 150, 260, 400, 580, 800, 1060, 1360, 1700, 2100, 2600, 3200, 3900, 4700, 5600, 6800, 8400, 10500, 13000];

export const RANKS: Rank[] = THRESHOLDS.map((min, i) => {
  if (i < 15) { const k = 15 - i; return { index: i, name: `${k} קיו`, kanji: `${KANJI[k]}級`, min }; }
  const d = i - 14;
  return { index: i, name: `${d} דאן`, kanji: `${d === 1 ? '初' : KANJI[d]}段`, min };
});

export function rankFor(xp: number): { rank: Rank; next?: Rank; into: number; span: number } {
  let i = 0;
  while (i + 1 < RANKS.length && xp >= RANKS[i + 1].min) i++;
  const rank = RANKS[i];
  const next = RANKS[i + 1];
  return { rank, next, into: xp - rank.min, span: next ? next.min - rank.min : 0 };
}
