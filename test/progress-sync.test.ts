import { describe, expect, test } from 'bun:test';
import { merge, normalize, NICKNAME_RE, RESERVED_RE, stats } from '../src/lib/progress-sync';

describe('progress sync', () => {
  test('merge keeps the best score per level and every finished lesson', () => {
    const a = normalize({ learn: { stages: { king: { scores: [3, 1] } } }, rules: ['01'] });
    const b = normalize({ learn: { stages: { king: { scores: [2, 2, 3] }, gold: { scores: [1] } } }, rules: ['02', '01'] });
    expect(merge(a, b)).toEqual({ learn: { stages: { king: { scores: [3, 2, 3] }, gold: { scores: [1] } } }, rules: ['01', '02'] });
  });

  test('normalize survives junk', () => {
    expect(normalize(null)).toEqual({ learn: { stages: {} }, rules: [] });
    expect(normalize({ learn: { stages: { x: { scores: [9, -1, 'a', null] }, y: 5 } }, rules: [1, 'a'] }))
      .toEqual({ learn: { stages: { x: { scores: [3, 0, 0, 0] } } }, rules: ['a'] });
  });

  test('stats count stars, levels and finished stages', () => {
    const p = normalize({ learn: { stages: { king: { scores: [3, 2] }, gold: { scores: [1] } } }, rules: ['01'] });
    expect(stats(p, { king: 2, gold: 3 })).toEqual({
      stars: 6, maxStars: 15, levelsDone: 3, levels: 5, stagesDone: 1, stages: 2, rulesDone: 1,
    });
  });

  test('nicknames', () => {
    for (const ok of ['דין', 'Dean_77', 'שוגי-מאסטר', 'abc']) expect(NICKNAME_RE.test(ok)).toBe(true);
    for (const bad of ['ab', 'a b', 'x'.repeat(17), 'דין!', '']) expect(NICKNAME_RE.test(bad)).toBe(false);
    for (const r of ['Admin', 'ShogiIsrael', 'shogi_israel', 'מנהל_האתר', 'שוגי-ישראל']) expect(RESERVED_RE.test(r)).toBe(true);
    expect(RESERVED_RE.test('דין_שוגי')).toBe(false);
  });
});
