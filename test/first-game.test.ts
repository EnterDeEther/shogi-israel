// The first game (/try/): every move legal, ends in mate, tags and phases as the page shows them.
import { describe, expect, test } from 'bun:test';
import { parseSfen } from 'shogiops/sfen';
import { parseSquareName } from 'shogiops/util';
import { FIRST_GAME, PHASES, firstGamePlies, plainText } from '../src/lib/first-game';
import { EXERCISES } from '../src/scripts/try-pieces';
import { illegalShogigroundMoveDests } from '../src/learn/shogi';

describe('first game', () => {
  const plies = firstGamePlies();

  test('27 legal moves, ending in mate for the first player', () => {
    expect(FIRST_GAME.length).toBe(27);
    const last = plies.at(-1)!;
    expect(last.pos.outcome()).toEqual({ result: 'checkmate', winner: 'sente' });
    expect(last.tags).toContain('mate');
    // the position before it is the home page's "mate in one"
    expect(plies.at(-2)!.pos.outcome()).toBeUndefined();
  });

  test('every move has a title and an explanation', () => {
    for (const m of FIRST_GAME) {
      expect(m.title.length).toBeGreaterThan(2);
      expect(m.text.length).toBeGreaterThan(10);
    }
  });

  test('the three phases come in order and the texts match the tags', () => {
    expect(PHASES.map((p) => p.name)).toEqual(['פתיחה', 'אמצע המשחק', 'סוף המשחק']);
    expect(plies.slice(1).map((p) => p.phase)).toEqual([...plies.slice(1).map((p) => p.phase)].sort());
    plies.slice(1).forEach((p, i) => {
      const m = FIRST_GAME[i];
      if (p.tags.includes('drop')) expect(m.title + m.text).toMatch(/הצנח|מצניח/);
      if (p.tags.includes('promotion')) expect(m.title + m.text).toContain('הכתרה');
      if (p.tags.includes('check')) expect(m.title + m.text + (m.why ?? '')).toContain('שח');
    });
    // the end game is the race to mate: every first-player move in it gives check
    plies.forEach((p, i) => { if (p.phase === 2 && i % 2 === 1) expect(p.tags.some((t) => t === 'check' || t === 'mate')).toBe(true); });
  });
});

describe('three pieces try', () => {
  test('each exercise has one capture, the target, and the hand grows by one', () => {
    EXERCISES.forEach((e, i) => {
      const pos = parseSfen('standard', e.sfen, false).unwrap();
      const dests = illegalShogigroundMoveDests(pos).get(e.piece) ?? [];
      expect(dests).toContain(e.target);
      expect(pos.board.get(parseSquareName(e.target)!)?.color).toBe('gote');
      expect(e.sfen.split(' ')[2]).toBe(['-', 'P', 'PS'][i]);
    });
  });
});

// Someone who knows nothing must be able to follow the game. Each piece is introduced, with its
// mark, the first time any text names it (in the order the page shows them: phase note, then the move's texts).
describe('first game: nothing named before it is introduced', () => {
  const PIECES: [string, string][] = [['רגלי', '{P}'], ['צריח', '{R}'], ['גנרל זהב', '{G}'], ['רץ ', '{B}'], ['גנרל כסף', '{S}'], ['דרקון', '{+R}']];
  const texts: string[] = [];
  FIRST_GAME.forEach((m, i) => {
    const ph = PHASES.find((p) => p.first === i + 1);
    texts.push([ph?.note ?? '', m.title, m.text, m.why ?? ''].join(' '));
  });

  test('the first text that names a piece also shows it', () => {
    for (const [name, token] of PIECES) {
      const first = texts.find((t) => t.includes(name));
      expect(first, name).toBeDefined();
      expect(first!.includes(token), `${name} first named without ${token}`).toBe(true);
    }
  });

  test('piece marks are valid and stripped for screen readers', () => {
    for (const t of texts) for (const m of t.matchAll(/\{([^}]*)\}/g)) expect(m[1]).toMatch(/^\+?[KRBGSNLP]$/);
    expect(plainText('זה רגלי {P}, הכלי')).toBe('זה רגלי, הכלי');
  });
});
