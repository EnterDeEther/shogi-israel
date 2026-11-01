export const WEEK_LENGTH = 3;
const DAY = 24 * 60 * 60 * 1000;

export function weekIndex(d: Date = new Date()): number {
  const localDays = Math.floor((d.getTime() - d.getTimezoneOffset() * 60 * 1000) / DAY);
  return Math.floor((localDays + 4) / 7);
}

export function weekPuzzle(week: number, count: number): number {
  const pool = Math.max(1, Math.floor(count * 0.6));
  return (((week * 7919) % pool) + pool) % pool + 1;
}

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

export const weeksHe = (n: number): string => (n === 1 ? 'שבוע אחד' : n === 2 ? 'שבועיים' : `${n} שבועות`);
