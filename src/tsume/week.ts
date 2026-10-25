// Shogi Israel: the puzzle of the week (בעיית השבוע). One mate-in-3 puzzle a week, the same for everyone,
// picked from the week number, so nothing is stored and nothing needs a server: the streak is worked out
// from the puzzles already solved (src/tsume/puzzles.ts), which the account keeps in sync.
// Weeks start on Sunday, as in Israel, at the visitor's local midnight. Pure functions, tested in test/tsume-week.test.ts.

export const WEEK_LENGTH = 3; // mate in 3: short enough for newcomers, not trivial for regulars
const DAY = 24 * 60 * 60 * 1000;

/** Weeks since the Sunday before 1 Jan 1970 (a Thursday), in local time. */
export function weekIndex(d: Date = new Date()): number {
  const localDays = Math.floor((d.getTime() - d.getTimezoneOffset() * 60 * 1000) / DAY);
  return Math.floor((localDays + 4) / 7);
}

/**
 * The puzzle number (1-based) for a week. The collection is sorted easiest first; the weekly puzzle comes
 * from the easier 60%, spread so that neighbouring weeks are far apart.
 */
export function weekPuzzle(week: number, count: number): number {
  const pool = Math.max(1, Math.floor(count * 0.6));
  return (((week * 7919) % pool) + pool) % pool + 1;
}

/**
 * Weeks in a row with the week's puzzle solved, ending this week, or last week while this week's is still
 * open (a streak isn't lost until the week ends).
 */
export function weekStreak(solved: number[], count: number, week = weekIndex()): number {
  const done = new Set(solved);
  let w = done.has(weekPuzzle(week, count)) ? week : week - 1;
  let streak = 0;
  while (streak < 520 && done.has(weekPuzzle(w, count))) {
    streak++;
    w--;
  }
  return streak;
}

/** Hebrew for "N weeks" (שבוע אחד, שבועיים, 3 שבועות). */
export const weeksHe = (n: number): string => (n === 1 ? 'שבוע אחד' : n === 2 ? 'שבועיים' : `${n} שבועות`);
