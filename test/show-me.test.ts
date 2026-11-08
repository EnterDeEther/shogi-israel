import { describe, expect, test } from 'bun:test';
import { stages } from '../src/learn/categories';
import { hintMove, userMoves, withOpponent } from '../src/learn/hint';
import { HINT_LINES } from '../src/learn/hint-lines';
import type { Level, UsiWithColor } from '../src/learn/interfaces';
import { calcScore } from '../src/learn/level';

const key = (stage: string, level: Level) => `${stage}#${level.id}`;

function follow(stage: string, level: Level, start: UsiWithColor[] = []): UsiWithColor[] | undefined {
  const known = HINT_LINES[key(stage, level)]?.split(' ');
  let l = withOpponent(level, start);
  for (let i = 0; i < 40; i++) {
    const usi = hintMove(level, l, known, 3000);
    if (!usi) return undefined;
    l = withOpponent(level, [...l, { usi, color: level.color }]);
    if (level.success(level, l)) return l;
    if (level.failure?.(level, l)) return undefined;
  }
  return undefined;
}

describe('following "show me" from the start earns 3 stars', () => {
  for (const stage of stages)
    for (const level of stage.levels)
      test(key(stage.key, level), () => {
        const done = follow(stage.key, level);
        expect(done, level.goal).toBeDefined();
        expect(calcScore(level, done!)).toBe(3);
      });
});

test('every saved line belongs to an exercise without its own move list', () => {
  const keys = new Set(stages.flatMap((s) => s.levels.filter((l) => !l.scenario && !l.line).map((l) => key(s.key, l))));
  expect(Object.keys(HINT_LINES).filter((k) => !keys.has(k))).toEqual([]);
  expect([...keys].filter((k) => !HINT_LINES[k])).toEqual([]);
});

const level = (stage: string, id: number) => stages.find((s) => s.key === stage)!.levels[id - 1];
const own = (lvl: Level, usis: string[]): UsiWithColor[] => usis.map((usi) => ({ usi, color: lvl.color }));

test('"show me" still finishes after a wrong move', () => {
  for (const [stage, id, detour] of [
    ['lance', 2, ['9i9b']],
    ['knight', 2, ['8h9f']],
    ['rook', 1, ['5h9h']],
  ] as const) {
    const lvl = level(stage, id);
    expect(follow(stage, lvl, own(lvl, [...detour])), `${stage} #${id}`).toBeDefined();
  }
});

test('"show me" points to the next move of a scripted line', () => {
  const lvl = stages.find((s) => s.levels.some((l) => l.scenario && l.why))!.levels.find((l) => l.scenario && l.why)!;
  const first = lvl.scenario!.find((u) => u.color === lvl.color)!.usi;
  expect(hintMove(lvl, withOpponent(lvl, []))).toBe(first);
});

const castles = stages.filter((s) => s.levels.some((l) => l.line));

test('castle moves off the list or out of order are marked wrong', () => {
  for (const s of castles)
    for (const l of s.levels)
      for (const usi of userMoves(l, [])) if (usi !== l.line![0]) expect(l.failure!(l, own(l, [usi])), `${s.key} #${l.id} ${usi}`).toBe(true);
});

test('"show me" in a castle points to the next listed move', () => {
  for (const s of castles)
    for (const l of s.levels)
      for (let k = 0; k < l.line!.length; k++) expect(hintMove(l, own(l, l.line!.slice(0, k))), `${s.key} #${l.id} step ${k}`).toBe(l.line![k]);
});
