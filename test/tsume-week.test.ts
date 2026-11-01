import { describe, expect, test } from 'bun:test';
import { weekIndex, weekPuzzle, weekStreak, weeksHe } from '../src/tsume/week';

describe('puzzle of the week', () => {
  test('a week runs Sunday to Saturday', () => {
    const sun = weekIndex(new Date(2026, 9, 25, 0, 5));
    expect(weekIndex(new Date(2026, 9, 31, 23, 55))).toBe(sun);
    expect(weekIndex(new Date(2026, 9, 24, 23, 55))).toBe(sun - 1);
    expect(weekIndex(new Date(2026, 10, 1, 0, 5))).toBe(sun + 1);
  });

  test('puzzles come from the easier 60% and neighbouring weeks differ', () => {
    for (let w = 2900; w < 3000; w++) {
      const n = weekPuzzle(w, 1000);
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(600);
      expect(weekPuzzle(w + 1, 1000)).not.toBe(n);
    }
  });

  test('the streak counts weeks in a row and survives an open week', () => {
    const w = 3000;
    const solved = [weekPuzzle(w - 1, 1000), weekPuzzle(w - 2, 1000), weekPuzzle(w - 4, 1000)];
    expect(weekStreak(solved, 1000, w)).toBe(2);
    expect(weekStreak([...solved, weekPuzzle(w, 1000)], 1000, w)).toBe(3);
    expect(weekStreak([], 1000, w)).toBe(0);
  });

  test('Hebrew week counts', () => {
    expect(weeksHe(1)).toBe('שבוע אחד');
    expect(weeksHe(2)).toBe('שבועיים');
    expect(weeksHe(5)).toBe('5 שבועות');
  });
});
