import { describe, expect, test } from 'bun:test';
import { endText, gamePositions, kifFileName, makeKif, parseKif, westernMove } from '../src/lib/kif';

// A short real game shape: bishop exchange, then a drop, a capture on the same square and a promotion.
const MOVES = ['7g7f', '3c3d', '8h2b+', '3a2b', 'B*4e', '2b3c', '4e3d', '3c3d'];

describe('makeKif', () => {
  const kif = makeKif({
    moves: MOVES, sente: 'Dean', gote: 'AI', date: new Date(2026, 9, 24, 22, 10, 5),
    end: { reason: 'resign', winner: 'gote' },
  });
  test('header', () => {
    expect(kif.startsWith('#KIF version=2.0 encoding=UTF-8\n')).toBe(true);
    expect(kif).toContain('開始日時：2026/10/24 22:10:05');
    expect(kif).toContain('手合割：平手');
    expect(kif).toContain('先手：Dean');
    expect(kif).toContain('後手：AI');
    expect(kif).toContain('手数----指手---------消費時間--');
  });
  test('moves: promotion, drop, same square', () => {
    expect(kif).toContain('   1 ７六歩(77)');
    expect(kif).toContain('   3 ２二角成(88)');
    expect(kif).toContain('   4 同　銀(31)');
    expect(kif).toContain('   5 ４五角打');
    expect(kif).toContain('   8 同　銀(33)');
  });
  test('ending', () => {
    expect(kif).toContain('   9 投了');
    expect(kif).toContain('まで8手で後手の勝ち');
  });
  test('illegal move throws', () => {
    expect(() => makeKif({ moves: ['7g7e'] })).toThrow();
  });
  test('handicap names the players 下手 / 上手', () => {
    const k = makeKif({ startSfen: 'lnsgkgsnl/1r7/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL w - 1', moves: ['3c3d'], sente: 'A', gote: 'B' });
    expect(k).toContain('手合割：角落ち');
    expect(k).toContain('下手：A');
    expect(k).toContain('上手：B');
  });
});

describe('parseKif', () => {
  test('round trip', () => {
    const game = { moves: MOVES, sente: 'Dean', gote: 'AI', date: new Date(2026, 9, 24, 22, 10, 5), end: { reason: 'resign' as const, winner: 'gote' as const } };
    const r = parseKif(makeKif(game));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.game.moves).toEqual(MOVES);
    expect(r.game.sente).toBe('Dean');
    expect(r.game.gote).toBe('AI');
    expect(r.game.end).toEqual({ reason: 'resign', winner: 'gote' });
    expect(r.game.date?.getTime()).toBe(game.date.getTime());
  });
  test('Shift_JIS-era style: times, 王, half-width time column, comments, variations', () => {
    const kif = [
      '# ---- Kifu for Windows V7 棋譜ファイル ----',
      '開始日時：2020/01/02',
      '手合割：平手　　',
      '先手：羽生',
      '後手：藤井',
      '手数----指手---------消費時間--',
      '   1 ７六歩(77)   ( 0:01/00:00:01)',
      '*初手のコメント',
      '   2 ３四歩(33)   ( 0:02/00:00:02)+',
      '   3 ２二角成(88)   ( 0:03/00:00:04)',
      '   4 同　銀(31)   ( 0:01/00:00:03)',
      '   5 ５八王(59)   ( 0:01/00:00:05)',
      '   6 切れ負け',
      '',
      '変化：2手',
      '   2 ８四歩(83)   ( 0:00/00:00:00)',
    ].join('\r\n');
    const r = parseKif(kif);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.game.moves).toEqual(['7g7f', '3c3d', '8h2b+', '3a2b', '5i5h']);
    expect(r.game.end).toEqual({ reason: 'timeout', winner: 'sente' });
    expect(r.game.sente).toBe('羽生');
  });
  test('illegal move gives a Hebrew error with the move number', () => {
    const r = parseKif('手合割：平手\n手数----指手--\n   1 ７五歩(77)\n');
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toContain('מהלך 1');
  });
  test('garbage', () => {
    expect(parseKif('').ok).toBe(false);
    expect(parseKif('hello world').ok).toBe(false);
  });
  test('handicap start', () => {
    const r = parseKif('手合割：二枚落ち\n上手：先生\n下手：生徒\n手数----指手--\n   1 ６二銀(71)\n');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.game.startSfen.split(' ')[1]).toBe('w');
    expect(r.game.sente).toBe('生徒');
    expect(r.game.gote).toBe('先生');
  });
});

test('gamePositions, westernMove, endText, kifFileName', () => {
  const ps = gamePositions({ moves: MOVES });
  expect(ps.length).toBe(MOVES.length + 1);
  expect(westernMove(ps[0], MOVES[0])).toBe('P-76');
  expect(westernMove(ps[2], MOVES[2])).toBe('Bx22+');
  expect(westernMove(ps[4], MOVES[4])).toBe('B*45');
  expect(endText({ reason: 'resign', winner: 'gote' })).toBe('ניצחון להמשיב: כניעה');
  expect(endText({ reason: 'repetition' })).toBe('תיקו: חזרה מרובעת');
  expect(kifFileName({ date: new Date(2026, 9, 24, 9, 5) })).toBe('shogi-israel-2026-10-24-0905.kif');
});
