// AGPL-3.0-or-later, like the rest of src/learn/.

import { makeSfen, parseSfen } from 'shogiops/sfen';
import type { Position } from 'shogiops/variant/position';
import { makeSquareName, parseUsi } from 'shogiops/util';
import { i18nFormat } from './i18n';
import { describeLine, hintShown, nextMoveShapes, pieceList } from './describe';
import type { IncompleteLevel, IncompleteStage, Level, UsiWithColor } from './interfaces';
import { createLevel } from './level';
import { scenarioFailure, scenarioSuccess } from './assert';
import { arrow, circle } from './shapes';
import { createScenario, currentPosition } from './util';

const START = 'lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1';

export interface OpeningLevel {
  aim: string;
  why: string[];
  replies?: string[];
}
export interface OpeningStage {
  key: string;
  title: string;
  subtitle: string;
  intro: string;
  complete: string;
  line: string;
  skip?: number;
  levels: OpeningLevel[];
}
export interface WhatIfLevel {
  aim: string;
  setup: string;
  line: string;
  why: string[];
  replies?: string[];
}
export interface WhatIfStage {
  key: string;
  title: string;
  subtitle: string;
  intro: string;
  complete: string;
  levels: WhatIfLevel[];
}
export interface CastleLevel {
  aim: string;
  build: string;
}
export interface CastleStage {
  key: string;
  title: string;
  subtitle: string;
  intro: string;
  complete: string;
  levels: CastleLevel[];
}

export function play(pos: Position, usi: string, forceTurn = false): void {
  if (forceTurn) pos.turn = 'sente';
  const move = parseUsi(usi)!;
  if (!pos.isLegal(move)) throw new Error(`illegal ${usi} in ${makeSfen(pos)}`);
  pos.play(move);
}

const startPos = () => parseSfen('standard', START, false).unwrap();

export function openingStage(d: OpeningStage): IncompleteStage {
  const plies = d.line.trim().split(/\s+/);
  const pos = startPos();
  let p = 0;
  for (; p < 2 * (d.skip ?? 0); p++) play(pos, plies[p]);
  const levels: IncompleteLevel[] = d.levels.map((l) => {
    const sfen = makeSfen(pos);
    const slice = plies.slice(p, Math.min(p + 2 * l.why.length, plies.length));
    const text = describeLine(pos.clone(), slice);
    slice.forEach((u) => play(pos, u));
    p += slice.length;
    return {
      goal: l.aim.includes('==') ? l.aim : `==${l.aim}==`,
      sfen,
      nbMoves: text.orders.length,
      success: scenarioSuccess,
      failure: scenarioFailure,
      scenario: createScenario(slice, 'sente', true),
      drawShapes: nextMoveShapes,
      why: l.why,
      moveOrders: text.orders,
      moveNames: text.done,
      replies: l.replies,
      replyNames: text.replies,
    };
  });
  return {
    key: d.key, title: d.title, subtitle: d.subtitle, intro: d.intro, complete: d.complete,
    levels: levels.map((l, i) => createLevel(l, i)),
  };
}

export function whatIfStage(d: WhatIfStage): IncompleteStage {
  const levels: IncompleteLevel[] = d.levels.map((l) => {
    const pos = startPos();
    const setup = l.setup.trim().split(/\s+/);
    setup.forEach((u) => play(pos, u));
    const sfen = makeSfen(pos);
    const mistake = parseUsi(setup[setup.length - 1])!;
    const slice = l.line.trim().split(/\s+/);
    const text = describeLine(pos.clone(), slice);
    return {
      goal: l.aim,
      sfen,
      nbMoves: l.why.length,
      success: scenarioSuccess,
      failure: scenarioFailure,
      scenario: createScenario(slice, 'sente', true),
      drawShapes: (level: Level, usiCList: UsiWithColor[]) =>
        [...(usiCList.length || !('from' in mistake) ? [] : [arrow(makeSquareName(mistake.from), makeSquareName(mistake.to), 'red')]), ...nextMoveShapes(level, usiCList)],
      why: l.why,
      moveOrders: text.orders,
      moveNames: text.done,
      replies: l.replies,
      replyNames: text.replies,
    };
  });
  return {
    key: d.key, title: d.title, subtitle: d.subtitle, intro: d.intro, complete: d.complete,
    levels: levels.map((l, i) => createLevel(l, i)),
  };
}

export function castleStage(d: CastleStage): IncompleteStage {
  const levels: IncompleteLevel[] = d.levels.map((l) => {
    const build = l.build.trim().split(/\s+/);
    const pos = startPos();
    const origin = new Map<number, number>();
    for (const u of build) {
      const m = parseUsi(u)!;
      if ('role' in m) continue;
      origin.set(m.to, origin.get(m.from) ?? m.from);
      origin.delete(m.from);
      play(pos, u, true);
    }
    const start = startPos();
    const target = [...pos.board.color('sente')].map((sq) => ({ sq, piece: pos.board.get(sq)! }));
    const routes = [...origin].filter(([to, from]) => to !== from).map(([to, from]) => ({ from, to, piece: pos.board.get(to)! }));
    const success = (level: Level, usiCList: UsiWithColor[]) => {
      const now = currentPosition(level, usiCList);
      return target.every(({ sq, piece }) => {
        const p = now.board.get(sq);
        return p?.color === piece.color && p.role === piece.role;
      });
    };
    const shapes = (level: Level, usiCList: UsiWithColor[]) => {
      const now = currentPosition(level, usiCList);
      return routes.flatMap(({ from, to, piece }) => {
        const there = now.board.get(to);
        if (there?.color === piece.color && there.role === piece.role) return [];
        const home = now.board.get(from);
        return hintShown(level, usiCList) && home?.color === piece.color && home.role === piece.role
          ? [circle(makeSquareName(to)), arrow(makeSquareName(from), makeSquareName(to))]
          : [circle(makeSquareName(to))];
      });
    };
    return {
      goal: `${l.aim} ${i18nFormat('il_castleArrows', pieceList(start, routes.map((r) => r.from)))}`,
      sfen: START,
      nbMoves: build.length,
      success,
      drawShapes: shapes,
      recap: l.aim,
      line: build,
    };
  });
  return {
    key: d.key, title: d.title, subtitle: d.subtitle, intro: d.intro, complete: d.complete,
    levels: levels.map((l, i) => createLevel(l, i)),
  };
}

