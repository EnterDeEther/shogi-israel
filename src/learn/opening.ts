// Shogi Israel (shogi.co.il), 2026-10-24: builds opening, strategy and castle stages from a full move line,
// so each lesson is written as data (src/learn/stages/openings-he.ts) instead of hand-computed positions.
// Lines come from the openings research (knowledge/content/learn/openings-research.md), checked move by move.
// AGPL-3.0-or-later, like the rest of src/learn/.

import { makeSfen, parseSfen } from 'shogiops/sfen';
import type { Position } from 'shogiops/variant/position';
import { makeSquareName, parseUsi } from 'shogiops/util';
import { i18nFormat } from './i18n';
import type { IncompleteLevel, IncompleteStage, Level, UsiWithColor } from './interfaces';
import { createLevel } from './level';
import { scenarioFailure, scenarioSuccess } from './assert';
import { circle } from './shapes';
import { createScenario, currentPosition } from './util';

const START = 'lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1';

export interface OpeningLevel {
  aim: string; // what this part of the opening is for
  why: string[]; // one reason per sente move in this part
}
export interface OpeningStage {
  key: string;
  title: string;
  subtitle: string;
  intro: string;
  complete: string;
  line: string; // USI from the start position, sente and gote alternating
  skip?: number; // sente moves already played before the stage starts (taught in an earlier stage)
  levels: OpeningLevel[];
}
export interface CastleLevel {
  aim: string;
  build: string; // sente-only USI from the start position; the opponent waits
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

/** Western move in our 76-style squares: P-76, Rx24, P*24, Sx23+, G69-58. Plays the move on pos. */
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
    // name the starting square when another piece of the same kind could also go there
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
    const slice = plies.slice(p, Math.min(p + 2 * l.why.length, plies.length));
    const western = slice.map((u) => playWestern(pos, u)).filter((_, i) => i % 2 === 0);
    p += slice.length;
    return {
      goal: `${l.aim} ${i18nFormat('il_movesList', western.join(', '))}`,
      sfen,
      nbMoves: western.length,
      success: scenarioSuccess,
      failure: scenarioFailure,
      scenario: createScenario(slice, 'sente', true),
      why: l.why,
      moveNames: western,
    };
  });
  return {
    key: d.key, title: d.title, subtitle: d.subtitle, intro: d.intro, complete: d.complete,
    levels: levels.map((l, i) => createLevel(l, i)),
  };
}

/** The opponent waits; the level is done when every one of the user's pieces stands where the finished castle has it. */
export function castleStage(d: CastleStage): IncompleteStage {
  const levels: IncompleteLevel[] = d.levels.map((l) => {
    const build = l.build.trim().split(/\s+/);
    const pos = startPos();
    const western = build.map((u) => playWestern(pos, u, true));
    const start = startPos();
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
    return {
      goal: `${l.aim} ${i18nFormat('il_movesAnyOrder', western.join(', '))}`,
      sfen: START,
      nbMoves: build.length,
      success,
      drawShapes: () => moved.map(({ sq }) => circle(makeSquareName(sq))),
      line: build,
    };
  });
  return {
    key: d.key, title: d.title, subtitle: d.subtitle, intro: d.intro, complete: d.complete,
    levels: levels.map((l, i) => createLevel(l, i)),
  };
}

