// AGPL-3.0-or-later.
import { describe, expect, test } from 'bun:test';
import { bookMove } from '../src/play/book';
import { Line, START_SFEN } from '../src/play/game';
import { getLevel, levels } from '../src/play/levels';

describe('Line', () => {
  test('notation uses two-digit squares', () => {
    const l = new Line(undefined, ['7g7f', '3c3d', '8h2b+', '3a2b']);
    expect(l.plies.map((p) => p.western)).toEqual(['P-76', 'P-34', 'Bx22+', 'Sx22']);
    expect(l.current.turn).toBe('sente');
  });

  test('drops and declined promotion', () => {
    const l = new Line(undefined, ['7g7f', '3c3d', '8h2b=', '3a2b', 'B*4e']);
    expect(l.plies[2].western).toBe('Bx22=');
    expect(l.plies[4].western).toBe('B*45');
  });

  test('illegal moves are refused', () => {
    expect(new Line().isLegal('7g7e')).toBe(false);
    expect(() => new Line(undefined, ['7g7e'])).toThrow();
  });

  test('undo takes back plies', () => {
    const l = new Line(undefined, ['7g7f', '3c3d', '2g2f']);
    expect(l.undo(2).usis).toEqual(['7g7f']);
    expect(l.undo(9).usis).toEqual([]);
  });

  test('checkmate ends the game', () => {
    const l = new Line('4k4/9/4P4/9/9/9/9/9/4K4 b G 1', ['G*5b']);
    expect(l.end()).toEqual({ reason: 'mate', winner: 'sente' });
  });

  test('four-fold repetition is a draw', () => {
    const cycle = ['5i4h', '5a4b', '4h5i', '4b5a'];
    const l = new Line('4k4/9/9/9/9/9/9/9/4K4 b Pp 1', [...cycle, ...cycle, ...cycle]);
    expect(l.end()).toEqual({ reason: 'repetition' });
    expect(new Line('4k4/9/9/9/9/9/9/9/4K4 b Pp 1', [...cycle, ...cycle]).end()).toBeUndefined();
  });

  test('perpetual check loses for the checking side', () => {
    const start = '3k5/9/9/9/9/9/9/9/K3R4 b Pp 1';
    const cycle = ['5i6i', '6a5a', '6i5i', '5a6a'];
    const l = new Line(start, [...cycle, ...cycle, ...cycle]);
    expect(l.end()).toEqual({ reason: 'perpetual', winner: 'gote' });
  });
});

describe('levels', () => {
  test('ten levels, Lishogi engines', () => {
    expect(levels.length).toBe(10);
    expect(levels.filter((l) => l.engine === 'fairy').map((l) => l.level)).toEqual([1, 2, 3, 4]);
    expect(getLevel(99).level).toBe(10);
    expect(getLevel(0).level).toBe(1);
  });
});

describe('book', () => {
  test('book replies are legal', () => {
    let moves: string[] = [];
    for (let i = 0; i < 8; i++) {
      const m = bookMove(moves, () => 0.37 * ((i % 3) + 1) - Math.floor(0.37 * ((i % 3) + 1)));
      if (!m) break;
      expect(new Line(undefined, moves).isLegal(m)).toBe(true);
      moves = [...moves, m];
    }
    expect(moves.length).toBeGreaterThan(3);
    expect(bookMove(['1g1f', '1c1d', '9g9f'])).toBeUndefined();
  });
});

describe('the header play button', () => {
  const m = new Map<string, string>();
  (globalThis as { window?: unknown }).window = { localStorage: { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) } };
  const save = (record: object) => m.set('shogi-il.play.current', JSON.stringify({ record, clock: null, orientation: 'sente' }));
  const game = { id: 'a', version: 1, startedAt: '', startSfen: '', moves: ['7g7f', '3c3d'], playerColor: 'sente', level: 3, engine: '', clock: null, takebacks: 0 };

  test('continues a game still being played, and only that', async () => {
    const { gameInProgress } = await import('../src/play/record');
    expect(gameInProgress(false)).toBeNull();
    save(game);
    expect(gameInProgress(false)).toEqual({ moves: 2, level: 3, mode: 'ai', at: 0 });
    save({ ...game, result: { reason: 'mate', winner: 'sente' } });
    expect(gameInProgress(false)).toBeNull();
    m.set('shogi-il.play.current', '{not json');
    expect(gameInProgress(false)).toBeNull();
    m.delete('shogi-il.play.current');
  });

  test('two players on one device: own slot, phones and tablets only, the most recent game wins', async () => {
    const { gameInProgress, openGameText } = await import('../src/play/record');
    const local = { ...game, id: 'b', moves: ['7g7f'], mode: 'local' };
    m.set('shogi-il.play.local.current', JSON.stringify({ record: local, clock: null, orientation: 'sente', at: 200 }));
    expect(gameInProgress(false)).toBeNull(); // desktop never continues a two-player game
    expect(gameInProgress(true)?.mode).toBe('local');
    m.set('shogi-il.play.current', JSON.stringify({ record: game, clock: null, orientation: 'sente', at: 100 }));
    expect(gameInProgress(true)?.mode).toBe('local');
    m.set('shogi-il.play.current', JSON.stringify({ record: game, clock: null, orientation: 'sente', at: 300 }));
    expect(gameInProgress(true)?.mode).toBe('ai');
    expect(openGameText({ moves: 1, level: 1, mode: 'local', at: 0 })).toBe('שני שחקנים, אחרי מהלך אחד');
    expect(openGameText({ moves: 2, level: 3, mode: 'ai', at: 0 })).toBe('רמה 3, אחרי 2 מהלכים');
    m.delete('shogi-il.play.current');
    m.delete('shogi-il.play.local.current');
  });

  test('two-player wins never count as beating a computer level, and their KIF names both sides', async () => {
    const { highestBeaten } = await import('../src/play/record');
    const { recordKif } = await import('../src/play/record-kif');
    const won = { ...game, startSfen: START_SFEN, result: { reason: 'resign', winner: 'sente' } };
    m.set('shogi-il.play.history', JSON.stringify([{ ...won, level: 9, mode: 'local' }, { ...won, level: 2 }]));
    expect(highestBeaten()).toBe(2);
    const kif = recordKif({ ...won, mode: 'local' } as never);
    expect(kif).toContain('先手：פותח');
    expect(kif).toContain('後手：משיב');
    const open = recordKif({ ...game, startSfen: START_SFEN, mode: 'local' } as never);
    expect(open).toContain('   2 ');
    expect(open).not.toContain('まで');
    m.delete('shogi-il.play.history');
  });
});
