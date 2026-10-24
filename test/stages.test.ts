// Every level of every ported stage can be solved with a perfect score (3 stars),
// replaying the controller's rules headlessly: the user's moves come from the same dest maps the
// board offers (ctrl.ts applyUserMoveOrDrop), the scripted opponent answers from level.scenario,
// and a level ends on level.success / level.failure. Also checks every string key exists in he.json.
import { describe, expect, test } from 'bun:test';
import { shogigroundDropDests, shogigroundMoveDests } from 'shogiops/compat';
import { makeSfen } from 'shogiops/sfen';
import { makeUsi, parseSquareName } from 'shogiops/util';
import { pieceCanPromote, pieceForcePromote } from 'shogiops/variant/util';
import { stages } from '../src/learn/categories';
import he from '../src/learn/i18n/he.json';
import type { Level, UsiWithColor } from '../src/learn/interfaces';
import { illegalShogigroundDropDests, illegalShogigroundMoveDests } from '../src/learn/shogi';
import { currentPosition } from '../src/learn/util';

function withOpponent(level: Level, list: UsiWithColor[]): UsiWithColor[] {
  const sc = level.scenario;
  const next = sc?.[list.length];
  if (sc && next && next.color !== level.color && list.every((u, i) => sc[i].usi === u.usi && sc[i].color === u.color))
    return [...list, next];
  return list;
}

function userMoves(level: Level, list: UsiWithColor[]): string[] {
  const pos = currentPosition(level, list);
  pos.turn = level.color;
  const illegal = !!level.offerIllegalDests || !!level.obstacles?.length;
  const moves = illegal ? illegalShogigroundMoveDests(pos) : shogigroundMoveDests(pos);
  const drops = illegal ? illegalShogigroundDropDests(pos) : shogigroundDropDests(pos);
  const out: string[] = [];
  for (const [from, dests] of moves) {
    const fromSq = parseSquareName(from)!;
    const piece = pos.board.get(fromSq)!;
    for (const to of dests) {
      const toSq = parseSquareName(to)!;
      const force = pieceForcePromote('standard')(piece, toSq);
      if (!force) out.push(makeUsi({ from: fromSq, to: toSq }));
      if (force || pieceCanPromote('standard')(piece, fromSq, toSq, undefined))
        out.push(makeUsi({ from: fromSq, to: toSq, promotion: true }));
    }
  }
  for (const [name, dests] of drops) {
    const role = name.split(' ')[1] as any;
    for (const to of dests) out.push(makeUsi({ role, to: parseSquareName(to)! }));
  }
  return out;
}

/** Depth-first search for a solution within level.nbMoves user moves (= 3 stars); captures first, drops last. */
function solve(level: Level): string[] | undefined {
  const huntOnly = !/k/i.test(level.sfen.split(' ')[0]) && !level.scenario && !level.obstacles;
  const dead = new Set<string>(); // position + moves left that we already know fail
  const go = (list: UsiWithColor[], depth: number): UsiWithColor[] | undefined => {
    const pos = currentPosition(level, list);
    const ranked = userMoves(level, list).map((usi) => ({ usi, cap: pos.board.has(parseSquareName(usi.slice(2, 4))!) ? 0 : usi[1] === '*' ? 2 : 1 }));
    ranked.sort((a, b) => a.cap - b.cap);
    for (const { usi } of ranked) {
      let l: UsiWithColor[];
      try {
        l = withOpponent(level, [...list, { usi, color: level.color }]);
        currentPosition(level, l);
      } catch {
        continue;
      }
      if (level.success(level, l)) return l;
      if (level.failure?.(level, l)) continue;
      const left = level.nbMoves - depth - 1;
      if (left <= 0) continue;
      // each move takes at most one star / one piece: prune lines that can no longer finish in time
      const starsLeft = (level.obstacles ?? []).filter((o) => !l.some((u) => u.usi.slice(2, 4) === o)).length;
      if (starsLeft > left) continue;
      if (huntOnly && enemyLeft(level, l) > left) continue;
      const key = `${makeSfen(currentPosition(level, l))}|${left}`;
      if (dead.has(key)) continue;
      const r = go(l, depth + 1);
      if (r) return r;
      dead.add(key);
    }
    return undefined;
  };
  return go(withOpponent(level, []), 0)?.filter((u) => u.color === level.color).map((u) => u.usi);
}

function enemyLeft(level: Level, l: UsiWithColor[]): number {
  const pos = currentPosition(level, l, true);
  return pos.board.color(level.color === 'sente' ? 'gote' : 'sente').size();
}

// Levels whose search space is too big for the solver (captured pieces in hand make every square a
// drop): checked against a line worked out by hand instead.
const knownLines: Record<string, string[]> = {
  // value #4: take rook, bishop, gold, silver, knight, lance, pawn in that order, dragon only
  'value#4': ['6f7g', '7g5g', '5g5d', '5d5h', '5h7h', '7h7f', '7f4f', '4f4d', '4d6d', '6d6g', '6g4g'],
  // castles: the opponent waits, so any move order works; these are the textbook ones
  'castles#1': ['5i4h', '4h3h', '3h2h', '3i3h', '6i5h'],
  'castles#2': ['5i6h', '6h7h', '4i5h'],
  'castles#3': ['7i6h', '6h7g', '6i7h', '4i5h', '5h6g'],
  'castles#4': ['8h7i', '7i6h', '5i6i', '6i7i', '7i8h'],
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
          const known = knownLines[`${stage.key}#${level.id}`];
          if (known) expect(playsOut(level, known)).toBe(true);
          else expect(solve(level), `${stage.key} #${level.id}: ${level.goal}`).toBeDefined();
        },
        120_000,
      );
});

test('20 stages, 120 levels', () => {
  expect(stages.length).toBe(20);
  expect(stages.reduce((a, s) => a + s.levels.length, 0)).toBe(120);
});

test('no string falls back to its key', () => {
  const strings = he as Record<string, string>;
  for (const s of stages) {
    for (const t of [s.title, s.subtitle, s.intro, s.complete, ...s.levels.flatMap((l) => [l.goal, l.text ?? '', ...(l.why ?? [])])])
      expect(Object.keys(strings).includes(t), `untranslated: ${t}`).toBe(false);
  }
});

test('every "why" list has one reason per user move', () => {
  for (const s of stages)
    for (const l of s.levels)
      if (l.why) expect(l.why.length, `${s.key} #${l.id}`).toBe(l.scenario?.filter((u) => u.color === l.color).length ?? l.nbMoves);
});
