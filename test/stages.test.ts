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

function solve(level: Level): string[] | undefined {
  const huntOnly = !/k/i.test(level.sfen.split(' ')[0]) && !level.scenario && !level.obstacles;
  const dead = new Set<string>();
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
          else expect(solve(level), `${stage.key} #${level.id}: ${level.goal}`).toBeDefined();
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
