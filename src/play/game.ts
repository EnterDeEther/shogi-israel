// Shogi Israel: the rules side of a game against the computer, on top of shogiops.
// shogiops knows legal moves, checkmate and stalemate. On top of it we add what a full game needs and
// Lishogi checks on its server: four-fold repetition (חזרה מרובעת, a draw, or a loss for the side that gave
// check on every move of the cycle), the 27-point impasse declaration (../learn/impasse.ts) and our notation.
// No DOM here, so test/play.test.ts can run it.
// AGPL-3.0-or-later, like the rest of this site.
import { makeWesternMoveOrDrop } from 'shogiops/notation/western';
import { initialSfen, makeSfen, parseSfen } from 'shogiops/sfen';
import { parseUsi } from 'shogiops/util';
import type { Position } from 'shogiops/variant/position';
import { impasse } from '../learn/impasse';

export const START_SFEN = initialSfen('standard');

export type EndReason = 'mate' | 'stalemate' | 'resign' | 'time' | 'repetition' | 'perpetual' | 'impasse' | 'draw';
export interface GameEnd {
  reason: EndReason;
  winner?: Color; // none = draw
}

export interface Ply {
  usi: string;
  western: string; // P-76, Bx22+, S*55, G49-58 (two-digit squares, our notation)
  color: Color; // who played it
  check: boolean;
  capture: boolean;
}

export const parsePos = (sfen: string): Position => parseSfen('standard', sfen, false).unwrap();

/** Board, hands and side to move: the parts that make "the same position" for repetition. */
const repetitionKey = (pos: Position): string => makeSfen(pos).split(' ').slice(0, 3).join(' ');

/** A game from `startSfen` and the USI moves played so far. Immutable: play() returns a new Line. */
export class Line {
  readonly plies: Ply[];
  private positions: Position[]; // positions[i] = before ply i; last = current
  private keys: string[];

  constructor(readonly startSfen: string = START_SFEN, usis: string[] = []) {
    const start = parsePos(startSfen);
    this.plies = [];
    this.positions = [start];
    this.keys = [repetitionKey(start)];
    for (const usi of usis) this.push(usi);
  }

  private push(usi: string): void {
    const pos = this.current.clone();
    const md = parseUsi(usi);
    if (!md || !pos.isLegal(md)) throw new Error(`illegal move ${usi} in ${makeSfen(pos)}`);
    const western = makeWesternMoveOrDrop(pos, md) ?? usi;
    const capture = 'from' in md && pos.board.has(md.to);
    const color = pos.turn;
    pos.play(md);
    this.plies.push({ usi, western, color, check: pos.isCheck(), capture });
    this.positions.push(pos);
    this.keys.push(repetitionKey(pos));
  }

  get current(): Position {
    return this.positions[this.positions.length - 1];
  }
  get usis(): string[] {
    return this.plies.map((p) => p.usi);
  }
  positionAt(ply: number): Position {
    return this.positions[Math.max(0, Math.min(ply, this.plies.length))];
  }

  isLegal(usi: string): boolean {
    const md = parseUsi(usi);
    return !!md && this.current.isLegal(md);
  }

  play(usi: string): Line {
    const next = new Line(this.startSfen);
    next.plies.push(...this.plies);
    next.positions = [...this.positions];
    next.keys = [...this.keys];
    next.push(usi);
    return next;
  }

  /** Take back the last n plies. */
  undo(n: number): Line {
    return new Line(this.startSfen, this.usis.slice(0, Math.max(0, this.plies.length - n)));
  }

  /** How the game stands after the last move, by the board alone (resign and time are the controller's). */
  end(): GameEnd | undefined {
    const pos = this.current;
    const outcome = pos.outcome();
    if (outcome) {
      if (outcome.result === 'checkmate') return { reason: 'mate', winner: outcome.winner };
      // No legal move and not in check: in shogi that player loses too.
      if (outcome.result === 'stalemate') return { reason: 'stalemate', winner: outcome.winner };
      return { reason: 'draw' };
    }
    return this.repetition();
  }

  /** Sennichite: the same position for the fourth time. */
  private repetition(): GameEnd | undefined {
    const last = this.keys.length - 1;
    const key = this.keys[last];
    const seen: number[] = [];
    this.keys.forEach((k, i) => k === key && seen.push(i));
    if (seen.length < 4) return undefined;
    // Perpetual check: one side checked with every move since the first time the position appeared.
    const from = seen[0];
    for (const color of ['sente', 'gote'] as Color[]) {
      const byColor = this.plies.slice(from).filter((p) => p.color === color);
      if (byColor.length && byColor.every((p) => p.check)) return { reason: 'perpetual', winner: color === 'sente' ? 'gote' : 'sente' };
    }
    return { reason: 'repetition' };
  }

  /** Can the side to move declare an impasse win (27-point rule) right now? */
  canDeclareImpasse(): boolean {
    return impasse(this.current).canDeclare;
  }
}
