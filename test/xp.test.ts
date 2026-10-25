import { describe, expect, test } from 'bun:test';
import { categories } from '../src/learn/categories';
import { LEVEL_COUNTS } from '../src/lib/level-counts';
import { normalize } from '../src/lib/progress-sync';
import { RANKS, rankFor, stepXp, XP, xpBreakdown } from '../src/lib/xp';
import { ALL_STEPS } from '../src/lib/curriculum';

describe('xp', () => {
  test('level counts match the lesson engine', () => {
    expect(LEVEL_COUNTS).toEqual(Object.fromEntries(categories.flatMap((c) => c.stages).map((s) => [s.key, s.levels.length])));
  });

  test('nothing done, no points', () => {
    expect(xpBreakdown(normalize({}), LEVEL_COUNTS).total).toBe(0);
  });

  test('each thing pays once: best stars, unique puzzles, lessons, first game and win per level', () => {
    const p = normalize({
      learn: { stages: { king: { scores: [3, 2, 0] } } },
      rules: ['01-board-pieces-setup'],
      tsume: { 1: [1, 2, 2, 2], 3: [7] },
      course: { played: 2, won: 1, seen: ['read-opening'] },
    });
    const x = xpBreakdown(p, LEVEL_COUNTS);
    expect(x.learn).toBe(5 * XP.star);
    expect(x.rules).toBe(XP.rules);
    expect(x.tsume).toBe(2 * XP.tsume[1] + XP.tsume[3]);
    expect(x.games).toBe(2 * XP.played + XP.won);
    expect(x.read).toBe(XP.read);
    expect(x.course).toBe(4 * XP.step); // rules-01, read-opening, play-first, play-opening
    // the same progress merged twice (another device, a replay) changes nothing
    expect(xpBreakdown(normalize({ ...p, rules: [...p.rules, ...p.rules] }), LEVEL_COUNTS).total).toBe(x.total);
  });

  test('skipped steps give no points', () => {
    const p = normalize({ course: { track: 'new', trackAt: 'x', skipped: ALL_STEPS.map((s) => s.id) } });
    expect(xpBreakdown(p, LEVEL_COUNTS).total).toBe(0);
  });

  test('a finished unit adds its bonus once', () => {
    const scores = (k: string) => ({ scores: Array(LEVEL_COUNTS[k]).fill(1) });
    const basicsLearn = ['introduction', 'king', 'rook', 'bishop', 'gold', 'silver', 'knight', 'lance', 'pawn', 'capture', 'drop', 'protection', 'check1', 'outOfCheck', 'checkmate1'];
    const p = normalize({
      rules: ['01-board-pieces-setup', '02-how-pieces-move', '03-promotion', '04-drops', '05-check-mate', '06-illegal-moves-endings'],
      learn: { stages: Object.fromEntries(basicsLearn.map((k) => [k, scores(k)])) },
      course: { track: 'new', trackAt: 'x', played: 1 },
    });
    const x = xpBreakdown(p, LEVEL_COUNTS);
    expect(x.course % XP.step).toBe(XP.unit % XP.step);
    expect(x.course).toBe(12 * XP.step + XP.unit);
  });

  test('ranks go from 15 קיו to 5 דאן and every step can earn something', () => {
    expect(RANKS[0].name).toBe('15 קיו');
    expect(RANKS[14].name).toBe('1 קיו');
    expect(RANKS[15]).toMatchObject({ name: '1 דאן', kanji: '初段' });
    expect(RANKS.at(-1)!.name).toBe('5 דאן');
    for (let i = 1; i < RANKS.length; i++) expect(RANKS[i].min).toBeGreaterThan(RANKS[i - 1].min);
    expect(rankFor(0).rank.name).toBe('15 קיו');
    expect(rankFor(RANKS[3].min).rank.index).toBe(3);
    expect(rankFor(RANKS[3].min - 1).rank.index).toBe(2);
    expect(rankFor(10 ** 6).next).toBeUndefined();
    for (const s of ALL_STEPS) expect(stepXp(s, LEVEL_COUNTS)).toBeGreaterThan(XP.step);
  });
});
