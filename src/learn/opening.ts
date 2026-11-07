// AGPL-3.0-or-later, like the rest of src/learn/.

import { makeSfen, parseSfen } from 'shogiops/sfen';
import type { Position } from 'shogiops/variant/position';
import { makeSquareName, parseUsi } from 'shogiops/util';
import { i18n, i18nFormat } from './i18n';
import type { IncompleteLevel, IncompleteStage, Level, UsiWithColor } from './interfaces';
import { createLevel } from './level';
import { scenarioFailure, scenarioSuccess } from './assert';
import { arrow, circle } from './shapes';
import { createScenario, currentPosition, usiDests } from './util';

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
  setup?: string;
  recap?: string;
}
export interface CastleStage {
  key: string;
  title: string;
  subtitle: string;
  intro: string;
  complete: string;
  levels: CastleLevel[];
}

const LETTER: Record<string, string> = {
  king: 'K', rook: 'R', bishop: 'B', gold: 'G', silver: 'S', knight: 'N', lance: 'L', pawn: 'P',
  dragon: '+R', horse: '+B', promotedsilver: '+S', promotedknight: '+N', promotedlance: '+L', tokin: '+P',
};
const sq76 = (key: string) => `${key[0]}${'abcdefghi'.indexOf(key[1]) + 1}`;

export function playWestern(pos: Position, usi: string, forceTurn = false): string {
  if (forceTurn) pos.turn = 'sente';
  const move = parseUsi(usi)!;
  if (!pos.isLegal(move)) throw new Error(`illegal ${usi} in ${makeSfen(pos)}`);
  const to = makeSquareName(move.to);
  let text: string;
  if ('role' in move) text = `${LETTER[move.role]}*${sq76(to)}`;
  else {
    const piece = pos.board.get(move.from)!;
    const capture = pos.board.has(move.to);
    const twin = [...pos.board.pieces(piece.color, piece.role)].some(
      (sq) => sq !== move.from && (pos.isLegal({ from: sq, to: move.to }) || pos.isLegal({ from: sq, to: move.to, promotion: true })),
    );
    text = `${LETTER[piece.role]}${twin ? sq76(makeSquareName(move.from)) : ''}${capture ? 'x' : '-'}${sq76(to)}${move.promotion ? '+' : ''}`;
  }
  pos.play(move);
  return text;
}

const startPos = () => parseSfen('standard', START, false).unwrap();

export function openingStage(d: OpeningStage): IncompleteStage {
  const plies = d.line.trim().split(/\s+/);
  const pos = startPos();
  let p = 0;
  for (; p < 2 * (d.skip ?? 0); p++) playWestern(pos, plies[p]);
  const levels: IncompleteLevel[] = d.levels.map((l) => {
    const sfen = makeSfen(pos);
    const lastDests = p > 0 ? usiDests(plies[p - 1]) : undefined;
    const slice = plies.slice(p, Math.min(p + 2 * l.why.length, plies.length));
    const all = slice.map((u) => playWestern(pos, u));
    const western = all.filter((_, i) => i % 2 === 0);
    p += slice.length;
    return {
      goal: `${l.aim.includes('==') ? l.aim : `==${l.aim}==`} ${i18nFormat('il_movesList', western.join(', '))}`,
      sfen,
      lastDests,
      nbMoves: western.length,
      success: scenarioSuccess,
      failure: scenarioFailure,
      scenario: createScenario(slice, 'sente', true),
      why: l.why,
      moveNames: western,
      replies: l.replies,
      replyNames: all.filter((_, i) => i % 2 === 1),
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
    setup.forEach((u) => playWestern(pos, u));
    const sfen = makeSfen(pos);
    const mistake = parseUsi(setup[setup.length - 1])!;
    const slice = l.line.trim().split(/\s+/);
    const all = slice.map((u) => playWestern(pos, u));
    return {
      goal: l.aim,
      sfen,
      nbMoves: l.why.length,
      success: scenarioSuccess,
      failure: scenarioFailure,
      scenario: createScenario(slice, 'sente', true),
      drawShapes: (_level: Level, usiCList: UsiWithColor[]) =>
        usiCList.length || !('from' in mistake) ? [] : [arrow(makeSquareName(mistake.from), makeSquareName(mistake.to), 'red')],
      why: l.why,
      moveNames: all.filter((_, i) => i % 2 === 0),
      replies: l.replies,
      replyNames: all.filter((_, i) => i % 2 === 1),
    };
  });
  return {
    key: d.key, title: d.title, subtitle: d.subtitle, intro: d.intro, complete: d.complete,
    levels: levels.map((l, i) => createLevel(l, i)),
  };
}

const ONE_WAY = new Set(['pawn', 'lance', 'knight']);

export function castleStage(d: CastleStage): IncompleteStage {
  const levels: IncompleteLevel[] = d.levels.map((l) => {
    const pos = startPos();
    for (const u of (l.setup ?? '').trim().split(/\s+/).filter(Boolean)) playWestern(pos, u, true);
    pos.turn = 'sente';
    const sfen = makeSfen(pos);
    const start = parseSfen('standard', sfen, false).unwrap();
    const allowed = new Set([...start.board.color('sente')].map((sq) => `${start.board.get(sq)!.role}@${sq}`));
    const build = l.build.trim().split(/\s+/);
    let anyOrder = false;
    const western = build.map((u, i) => {
      pos.turn = 'sente';
      anyOrder ||= build.slice(i + 1).some((v) => pos.isLegal(parseUsi(v)!));
      const text = playWestern(pos, u, true);
      const to = parseUsi(u)!.to;
      allowed.add(`${pos.board.get(to)!.role}@${to}`);
      return text;
    });
    const target = [...pos.board.color('sente')].map((sq) => ({ sq, piece: pos.board.get(sq)! }));
    const moved = target.filter(({ sq, piece }) => {
      const was = start.board.get(sq);
      return !was || was.role !== piece.role || was.color !== piece.color;
    });
    const success = (level: Level, usiCList: UsiWithColor[]) => {
      const now = currentPosition(level, usiCList);
      return target.every(({ sq, piece }) => {
        const p = now.board.get(sq);
        return p?.color === piece.color && p.role === piece.role;
      });
    };
    const failure = (level: Level, usiCList: UsiWithColor[]) => {
      const now = currentPosition(level, usiCList);
      return [...now.board.color('sente')].some((sq) => {
        const role = now.board.get(sq)!.role;
        return ONE_WAY.has(role) && !allowed.has(`${role}@${sq}`);
      });
    };
    return {
      goal: `${l.aim} ${i18nFormat(anyOrder ? 'il_movesAnyOrder' : 'il_movesInOrder', western.join(', '))}`,
      sfen,
      nbMoves: build.length,
      success,
      failure,
      failureHint: () => i18n('il_castleDeadEnd'),
      drawShapes: () => moved.map(({ sq }) => circle(makeSquareName(sq))),
      line: build,
      recap: l.recap,
    };
  });
  return {
    key: d.key, title: d.title, subtitle: d.subtitle, intro: d.intro, complete: d.complete,
    levels: levels.map((l, i) => createLevel(l, i)),
  };
}

