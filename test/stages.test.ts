import { describe, expect, test } from 'bun:test';
import { makeSfen, parseSfen } from 'shogiops/sfen';
import { stages } from '../src/learn/categories';
import { solve, userMoves, withOpponent } from '../src/learn/hint';
import { playWestern } from '../src/learn/opening';
import he from '../src/learn/i18n/he.json';
import type { Level, UsiWithColor } from '../src/learn/interfaces';
import { findCapture } from '../src/learn/shogi';
import { currentPosition, usiDests } from '../src/learn/util';

const knownLines: Record<string, string[]> = {
  'value#4': ['6f7g', '7g5g', '5g5d', '5d5h', '5h7h', '7h7f', '7f4f', '4f4d', '4d6d', '6d6g', '6g4g'],
};

function playsOut(level: Level, line: string[]): boolean {
  let l = withOpponent(level, []);
  for (const usi of line) {
    if (!userMoves(level, l).includes(usi)) return false;
    l = withOpponent(level, [...l, { usi, color: level.color }]);
    if (level.success(level, l)) return line.length <= level.nbMoves;
    if (level.failure?.(level, l)) return false;
  }
  return false;
}

describe('every level is solvable with 3 stars', () => {
  for (const stage of stages)
    for (const level of stage.levels)
      test(
        `${stage.key} #${level.id}`,
        () => {
          const known = knownLines[`${stage.key}#${level.id}`] ?? level.line;
          if (known) expect(playsOut(level, known)).toBe(true);
          else expect(solve(level, [], level.nbMoves), `${stage.key} #${level.id}: ${level.goal}`).toBeDefined();
        },
        120_000,
      );
});

test('42 stages, 195 levels', () => {
  expect(stages.length).toBe(42);
  expect(stages.reduce((a, s) => a + s.levels.length, 0)).toBe(195);
});

test('no string falls back to its key', () => {
  const strings = he as Record<string, string>;
  for (const s of stages) {
    for (const t of [s.title, s.subtitle, s.intro, s.complete, ...s.levels.flatMap((l) => [l.goal, l.text ?? '', l.recap ?? '', ...(l.why ?? []), ...(l.replies ?? [])])])
      expect(Object.keys(strings).includes(t), `untranslated: ${t}`).toBe(false);
  }
});

test('every "why" list has one reason per user move', () => {
  for (const s of stages)
    for (const l of s.levels)
      if (l.why) expect(l.why.length, `${s.key} #${l.id}`).toBe(l.scenario?.filter((u) => u.color === l.color).length ?? l.nbMoves);
});

test('every "replies" list has one note per opponent reply', () => {
  for (const s of stages)
    for (const l of s.levels)
      if (l.replies) {
        expect(l.replies.length, `${s.key} #${l.id}`).toBe(l.scenario!.filter((u) => u.color !== l.color).length);
        expect(l.replyNames!.length, `${s.key} #${l.id}`).toBe(l.replies.length);
      }
});

test('each "what if" punishment wins material', () => {
  const value: Record<string, number> = { pawn: 1, lance: 3, knight: 4, silver: 5, gold: 6, bishop: 8, rook: 10, tokin: 6, promotedlance: 6, promotedknight: 6, promotedsilver: 6, horse: 10, dragon: 12, king: 0 };
  const material = (pos: ReturnType<typeof currentPosition>) => {
    let m = 0;
    for (const sq of pos.board.occupied) { const p = pos.board.get(sq)!; m += (p.color === 'sente' ? 1 : -1) * value[p.role]; }
    for (const c of ['sente', 'gote'] as const) for (const [r, n] of pos.hands.color(c)) m += (c === 'sente' ? 1 : -1) * value[r] * n;
    return m;
  };
  const stage = stages.find((s) => s.key === 'whatIf')!;
  for (const l of stage.levels) {
    const gain = material(currentPosition(l, l.scenario)) - material(currentPosition(l, []));
    expect(gain, `whatIf #${l.id}`).toBeGreaterThanOrEqual(4);
  }
});

test('every move name matches its scenario move', () => {
  for (const s of stages)
    for (const l of s.levels)
      if (l.moveNames && l.scenario) {
        const pos = parseSfen('standard', l.sfen, false).unwrap();
        const names = l.scenario.map((u) => playWestern(pos, u.usi)).filter((_, i) => l.scenario![i].color === l.color);
        expect(names, `${s.key} #${l.id}`).toEqual(l.moveNames);
      }
});

const stageOf = (key: string) => stages.find((s) => s.key === key)!;
const own = (usis: string[]): UsiWithColor[] => usis.map((usi) => ({ usi, color: 'sente' }));

test('a castle says when a pawn, lance or knight left the plan', () => {
  const mino = stageOf('rangingCastles').levels[0];
  expect(mino.failure!(mino, own(['9g9f']))).toBe(true);
  expect(mino.failure!(mino, own(['7g7f', '7f7e']))).toBe(true);
  expect(mino.failure!(mino, own(['7g7f', '6g6f', '1g1f']))).toBe(false);
  expect(mino.failure!(mino, own(['4i5h', '5h4i']))).toBe(false);
  expect(mino.failureHint!(mino, own(['9g9f']))).toBe(he.il_castleDeadEnd);
  const yagura = stageOf('staticCastles').levels[1];
  expect(yagura.failure!(yagura, own(['1g1f']))).toBe(true);
});

test('castle upgrades start from the castle before them', () => {
  const levels = stageOf('rangingCastles').levels;
  expect(levels.map((l) => l.nbMoves)).toEqual([9, 2, 3, 5]);
  const anyOrder = he.il_movesAnyOrder.split('%s')[0];
  const inOrder = he.il_movesInOrder.split('%s')[0];
  expect(levels.map((l) => l.goal.includes(anyOrder) ? 'any' : l.goal.includes(inOrder) ? 'order' : '')).toEqual(['any', 'order', 'order', 'any']);
  const after = (l: Level) => makeSfen(currentPosition(l, own(l.line!))).split(' ')[0];
  expect(levels[1].sfen.split(' ')[0]).toBe(after(levels[0]));
  expect(levels[2].sfen.split(' ')[0]).toBe(after(levels[1]));
  for (const l of [...levels, ...stageOf('staticCastles').levels]) expect(l.recap, `castle #${l.id}`).toBeTruthy();
});

test('an exercise that starts after the opponent moved shows that move', () => {
  expect(stageOf('primitiveClimbingSilver').levels[0].lastDests).toEqual(['8e', '8f']);
  expect(stageOf('thirdFileRook').levels[0].lastDests).toBeUndefined();
  const ffr = stageOf('fourthFileRook').levels;
  expect(ffr[0].lastDests).toBeUndefined();
  const prev = ffr[0].scenario!;
  expect(ffr[1].lastDests).toEqual(usiDests(prev[prev.length - 1].usi));
});

test('opening tasks mark the aim as well as the move list', () => {
  for (const key of ['fourthFileRook', 'yagura', 'primitiveClimbingSilver', 'spearingSparrow'])
    for (const l of stageOf(key).levels) expect(l.goal.startsWith('=='), `${key} #${l.id}`).toBe(true);
});

test('spearing the sparrow brings lance, rook, silver and knight before the edge push', () => {
  expect(stageOf('spearingSparrow').levels.map((l) => l.moveNames)).toEqual([['L-17', 'R-18'], ['S-26', 'N-37', 'P-15']]);
});

test('piece value #8 accepts the sacrifice with or without promotion', () => {
  const level = stages.find((s) => s.key === 'value')!.levels[7];
  for (const line of [['7f4c+', 'S*3b', '3b4c+'], ['7f4c', 'S*3b', '3b4c'], ['7f4c', 'S*3b', '3b4c+'], ['7f4c+', 'S*3b', '3b4c']])
    expect(playsOut(level, line), line.join(' ')).toBe(true);
  expect(playsOut(level, ['7f5d', 'S*3b', '3b4c+'])).toBe(false);
});

test('piece value #5 shows the recapture after a bad rook exchange', () => {
  const level = stages.find((s) => s.key === 'value')!.levels[4];
  expect(level.showFailureMove).toBe('capture');
  for (const [usi, reply] of [['6h6d', '6c6d'], ['6h6e', '6d6e']]) {
    const pos = currentPosition(level, [{ usi, color: 'sente' }]);
    expect(findCapture(pos), usi).toBe(reply);
  }
});

test('piece value #6 shows the whole mate after the king takes the dragon', () => {
  const level = stages.find((s) => s.key === 'value')!.levels[5];
  const played: UsiWithColor[] = [...level.scenario!.slice(0, 1), { usi: '7h6h', color: 'sente' }];
  expect(level.failure!(level, played)).toBe(true);
  const show = typeof level.showFailureMove === 'function' ? level.showFailureMove(level, played) : undefined;
  expect(show).toEqual(['G*6g', '6h6i', 'G*6h']);
  const line = (show as string[]).map((usi, i) => ({ usi, color: i % 2 ? level.color : 'gote' }) as UsiWithColor);
  expect(currentPosition(level, [...played, ...line]).outcome()).toEqual({ result: 'checkmate', winner: 'gote' });
});

test('piece value #6 marks the checking gold in red after a wrong move', () => {
  const level = stages.find((s) => s.key === 'value')!.levels[5];
  const g = (usi: string): UsiWithColor => ({ usi, color: 'gote' });
  const s = (usi: string): UsiWithColor => ({ usi, color: 'sente' });
  const shapes = (list: UsiWithColor[]) => level.drawShapes!(level, list).map((d) => `${d.orig}${d.dest}:${d.brush}`);
  expect(shapes([g('6b6h+')])).toEqual([]);
  expect(shapes([g('6b6h+'), s('7h8g')])).toEqual([]);
  expect(shapes([g('6b6h+'), s('7h6h'), g('G*6g')])).toEqual(['6g6h:red']);
  expect(shapes([g('6b6h+'), s('7h6h'), g('G*6g'), s('6h6i')])).toEqual([]);
  expect(shapes([g('6b6h+'), s('7h6h'), g('G*6g'), s('6h6i'), g('G*6h')])).toEqual(['6h6i:red']);
  expect(shapes([g('6b6h+'), s('7h8i'), g('G*8h')])).toEqual(['8h8i:red']);
});
