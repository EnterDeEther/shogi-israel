import { describe, expect, test } from 'bun:test';
import { emptyProgress, gameResult, merge, mergeSignIn, normalize, NICKNAME_RE, RESERVED_RE, stats } from '../src/lib/progress-sync';

describe('progress sync', () => {
  test('merge keeps the best score per level and every finished lesson', () => {
    const a = normalize({ learn: { stages: { king: { scores: [3, 1] } } }, rules: ['01'] });
    const b = normalize({ learn: { stages: { king: { scores: [2, 2, 3] }, gold: { scores: [1] } } }, rules: ['02', '01'] });
    const m = merge(a, b);
    expect(m.learn).toEqual({ stages: { king: { scores: [3, 2, 3] }, gold: { scores: [1] } } });
    expect(m.rules).toEqual(['01', '02']);
  });

  test('signing in keeps the account: best of both, and the account choices win over a newer guest choice', () => {
    const guest = normalize({
      learn: { stages: { king: { scores: [1, 3] }, rook: { scores: [2] } } }, rules: ['01'], tsume: { 1: [5] },
      course: { route: 'main', start: 'beginner', placedAt: '2026-10-28T10:00:00Z', seen: ['g1'], played: 2 },
      inbox: { read: ['a'], off: [], offAt: '2026-10-28T10:00:00Z' },
    });
    const account = normalize({
      learn: { stages: { king: { scores: [3, 2] } } }, rules: ['02'], tsume: { 1: [7] },
      course: { route: 'chess', start: 'intermediate', placedAt: '2026-10-20T10:00:00Z', seen: ['g2'], won: 3 },
      inbox: { read: ['b'], off: ['news'], offAt: '2026-10-20T10:00:00Z' },
    });
    const m = mergeSignIn(guest, account);
    expect(m.learn).toEqual({ stages: { king: { scores: [3, 3] }, rook: { scores: [2] } } });
    expect(m.rules).toEqual(['01', '02']);
    expect(m.tsume).toEqual({ 1: [5, 7] });
    expect([m.course.route, m.course.start, m.course.placedAt]).toEqual(['chess', 'intermediate', '2026-10-20T10:00:00Z']);
    expect(m.course.seen).toEqual(['g1', 'g2']);
    expect([m.course.played, m.course.won]).toEqual([2, 3]);
    expect(m.inbox.off).toEqual(['news']);
    expect(m.inbox.read).toEqual(['a', 'b']);
    // plain merge (an already linked device) lets the newer choice win
    expect(merge(guest, account).course.route).toBe('main');
  });

  test('signing in to a new account keeps the guest choices', () => {
    const guest = normalize({ course: { route: 'chess', start: 'beginner', placedAt: '2026-10-28T10:00:00Z' }, inbox: { off: ['week'], offAt: '2026-10-28T10:00:00Z' } });
    const m = mergeSignIn(guest, emptyProgress());
    expect([m.course.route, m.course.start]).toEqual(['chess', 'beginner']);
    expect(m.inbox.off).toEqual(['week']);
  });

  test('normalize survives junk', () => {
    expect(normalize(null)).toEqual(emptyProgress());
    const p = normalize({ learn: { stages: { x: { scores: [9, -1, 'a', null] }, y: 5 } }, rules: [1, 'a'] });
    expect(p.learn).toEqual({ stages: { x: { scores: [3, 0, 0, 0] } } });
    expect(p.rules).toEqual(['a']);
  });

  test('stats count stars, levels and finished stages', () => {
    const p = normalize({ learn: { stages: { king: { scores: [3, 2] }, gold: { scores: [1] } } }, rules: ['01'] });
    expect(stats(p, { king: 2, gold: 3 })).toEqual({
      stars: 6, maxStars: 15, levelsDone: 3, levels: 5, stagesDone: 1, stages: 2, rulesDone: 1,
    });
  });

  test('nicknames', () => {
    for (const ok of ['שחקן', 'Player_77', 'שוגי-מאסטר', 'abc']) expect(NICKNAME_RE.test(ok)).toBe(true);
    for (const bad of ['ab', 'a b', 'x'.repeat(17), 'דין!', '']) expect(NICKNAME_RE.test(bad)).toBe(false);
    for (const r of ['Admin', 'ShogiIsrael', 'shogi_israel', 'מנהל_האתר', 'שוגי-ישראל']) expect(RESERVED_RE.test(r)).toBe(true);
    expect(RESERVED_RE.test('שחקן_שוגי')).toBe(false);
  });
});

describe('game result', () => {
  const g = (moves: number, winner?: string, playerColor = 'sente') => ({ moves: Array(moves).fill('7g7f'), playerColor, result: { winner } });
  test('from the player side', () => {
    expect(gameResult(g(40, 'sente'))).toBe('win');
    expect(gameResult(g(40, 'sente', 'gote'))).toBe('loss');
    expect(gameResult(g(40))).toBe('draw');
  });
  test('unfinished or too short is abandoned', () => {
    expect(gameResult(g(1, 'gote'))).toBe('abort');
    expect(gameResult({ moves: ['7g7f', '3c3d'], playerColor: 'sente' })).toBe('abort');
  });
});
