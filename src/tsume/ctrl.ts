// Shogi Israel: controller for the tsume player (/tsume/<N>/). The learner plays the attacker (sente);
// the defender's replies come from the puzzle's main line. Any mating move is accepted on the last move.
// A wrong move stays on the board with the defender's answer to it, until the learner takes it back.
// AGPL-3.0-or-later, like the rest of this site.
import type { Api } from 'shogiground/api';
import type { Config } from 'shogiground/config';
import { Shogiground } from 'shogiground/shogiground';
import type { Piece } from 'shogiground/types';
import { shogigroundDropDests, shogigroundMoveDests } from 'shogiops/compat';
import { makeSfen } from 'shogiops/sfen';
import type { Piece as OpsPiece, Role } from 'shogiops/types';
import { isDrop, makeSquareName, makeUsi, parseSquareName, parseUsi } from 'shogiops/util';
import { pieceCanPromote, pieceForcePromote, promote } from 'shogiops/variant/util';
import type { LearnPrefs } from '../learn/prefs';
import { arrow, circle } from '../learn/shapes';
import { play as playSound } from '../learn/sound';
import { Line } from '../play/game';
import { type Length, markSolved, type Puzzle, solvedList } from './puzzles';
import { legalMoves, Solver } from './solve';

const REPLY_MS = 550;

export type Feedback =
  | { kind: 'intro' }
  | { kind: 'good'; reply?: string } // reply: the defender's answer, in our notation
  | { kind: 'not-check' }
  | { kind: 'escape'; reply?: string } // a check that does not work; reply = the defender's way out
  | { kind: 'solved'; clean: boolean }
  | { kind: 'shown' };

export default class TsumeCtrl {
  ground: Api;
  puzzle!: Puzzle;
  id = 1; // 1-based number in this collection
  line!: Line;
  feedback: Feedback = { kind: 'intro' };
  mistakes = 0;
  hinted = false; // a hint was used on this puzzle
  private hintAt?: number; // the ply the shown hint is for
  busy = false; // the defender is about to answer
  viewPly?: number; // stepping through a solved puzzle; undefined = the live position
  private token = 0;

  constructor(
    readonly n: Length,
    readonly puzzles: Puzzle[],
    readonly pref: LearnPrefs,
    readonly redraw: () => void,
  ) {
    this.ground = Shogiground(this.groundConfig());
  }

  get count(): number {
    return this.puzzles.length;
  }
  get step(): number {
    return this.line.plies.length;
  }
  get done(): boolean {
    return this.feedback.kind === 'solved' || this.feedback.kind === 'shown';
  }
  get wrong(): boolean {
    return this.feedback.kind === 'not-check' || this.feedback.kind === 'escape';
  }
  get canMove(): boolean {
    return !this.done && !this.wrong && !this.busy && this.line.current.turn === 'sente' && this.viewPly === undefined;
  }
  get solved(): boolean {
    return solvedList(this.n).includes(this.id);
  }

  load(id: number): void {
    this.token++;
    this.id = Math.min(Math.max(1, id), this.count);
    this.puzzle = this.puzzles[this.id - 1];
    this.line = new Line(this.puzzle.sfen);
    this.feedback = { kind: 'intro' };
    this.mistakes = 0;
    this.hinted = false;
    this.hintAt = undefined;
    this.busy = false;
    this.viewPly = undefined;
    this.ground.set({ drawable: { autoShapes: [] } });
    this.syncGround();
    this.redraw();
  }

  // ---------------------------------------------------------------- the board

  private groundConfig(): Config {
    return {
      orientation: 'sente',
      movable: { free: false, showDests: this.pref.dests, events: { after: (o, d, prom) => this.onUserMove(o, d, prom) } },
      droppable: { free: false, showDests: this.pref.dests, events: { after: (p, k) => this.onUserDrop(p, k) } },
      // Same promotion rules as the lessons (ported from lila ui/learn/src/ground.ts).
      promotion: {
        promotesTo: (role) => promote('standard')(role as Role),
        movePromotionDialog: (orig: Key, dest: Key) => {
          const piece = this.ground.state.pieces.get(orig) as OpsPiece | undefined;
          return !!piece &&
            pieceCanPromote('standard')(piece, parseSquareName(orig)!, parseSquareName(dest)!, undefined) &&
            !pieceForcePromote('standard')(piece, parseSquareName(dest)!);
        },
        forceMovePromotion: (orig: Key, dest: Key) => {
          const piece = this.ground.state.pieces.get(orig) as OpsPiece | undefined;
          return !!piece && pieceForcePromote('standard')(piece, parseSquareName(dest)!);
        },
      },
      premovable: { enabled: false },
      predroppable: { enabled: false },
      animation: { enabled: this.pref.animation },
      coordinates: { enabled: true, files: 'numeric', ranks: 'numeric' },
      drawable: { enabled: true, visible: true },
      draggable: { enabled: true, showGhost: true, showTouchSquareOverlay: true },
      selectable: { enabled: true },
      highlight: { check: true, lastDests: true },
      hands: { inlined: true },
      events: {
        move: (_o, _d, _p, captured) => playSound(captured ? 'capture' : 'move'),
        drop: () => playSound('move'),
      },
    };
  }

  private lastDests(ply: number): Key[] {
    if (ply <= 0) return [];
    const md = parseUsi(this.line.plies[ply - 1].usi)!;
    return isDrop(md) ? [makeSquareName(md.to)] : [makeSquareName(md.from), makeSquareName(md.to)];
  }

  syncGround(): void {
    const ply = this.viewPly ?? this.step;
    const pos = this.line.positionAt(ply);
    const [board, , hands] = makeSfen(pos).split(' ');
    const can = this.canMove;
    this.ground.set({
      sfen: { board, hands },
      turnColor: pos.turn,
      activeColor: can ? 'sente' : undefined,
      lastDests: this.lastDests(ply),
      checks: pos.isCheck(),
      movable: { dests: can ? shogigroundMoveDests(pos) : new Map() },
      droppable: { dests: can ? shogigroundDropDests(pos) : new Map() },
    });
  }

  private onUserMove(orig: Key, dest: Key, promotion: boolean): void {
    this.userPlays(makeUsi({ from: parseSquareName(orig)!, to: parseSquareName(dest)!, promotion }));
  }

  private onUserDrop(piece: Piece, key: Key): void {
    this.userPlays(makeUsi({ role: piece.role as Role, to: parseSquareName(key)! }));
  }

  // ---------------------------------------------------------------- solving

  private userPlays(usi: string): void {
    if (!this.canMove || !this.line.isLegal(usi)) return this.syncGround();
    const step = this.step;
    const last = step === this.puzzle.line.length - 1;
    this.ground.set({ drawable: { autoShapes: [] } });
    this.line = this.line.play(usi);
    const mate = this.line.end()?.reason === 'mate';
    if (mate || (!last && usi === this.puzzle.line[step])) {
      if (mate) return this.finish();
      this.feedback = { kind: 'good' };
      this.answer(this.puzzle.line[step + 1]);
      return;
    }
    this.mistakes++;
    playSound('fail');
    if (!this.line.current.isCheck()) this.feedback = { kind: 'not-check' };
    else {
      this.feedback = { kind: 'escape' };
      const reply = this.refutation(this.puzzle.line.length - step - 1);
      if (reply) this.answer(reply, true);
    }
    this.syncGround();
    this.redraw();
  }

  /** The defender's answer, after a short pause so the learner sees their own move land. */
  private answer(usi: string, toWrongMove = false): void {
    const token = ++this.token;
    this.busy = true;
    this.syncGround();
    this.redraw();
    window.setTimeout(() => {
      if (token !== this.token) return;
      const md = parseUsi(usi)!;
      if (isDrop(md)) this.ground.drop({ role: md.role, color: 'gote' }, makeSquareName(md.to));
      else this.ground.move(makeSquareName(md.from), makeSquareName(md.to), md.promotion);
      this.line = this.line.play(usi);
      const western = this.line.plies[this.line.plies.length - 1].western;
      this.busy = false;
      if (toWrongMove) {
        this.feedback = { kind: 'escape', reply: western };
        // show where the king got away to
        if (!isDrop(md)) this.ground.set({ drawable: { autoShapes: [arrow(makeSquareName(md.from), makeSquareName(md.to), 'red')] } });
      } else this.feedback = { kind: 'good', reply: western };
      this.syncGround();
      this.redraw();
    }, REPLY_MS);
  }

  /**
   * A defender reply after which the attacker can no longer mate within the plies left, found with a small
   * search (the puzzle's own line is the only one that works, so one exists). Undefined if the search is too big.
   */
  private refutation(pliesLeft: number): string | undefined {
    const pos = this.line.current;
    const replies = legalMoves(pos);
    if (pliesLeft <= 1) return replies.length ? makeUsi(replies.find((r) => !isDrop(r)) ?? replies[0]) : undefined;
    const s = new Solver(300);
    try {
      for (const r of replies.sort((a, b) => Number(isDrop(a)) - Number(isDrop(b)))) {
        const next = pos.clone();
        next.play(r);
        if (!s.mates(next, pliesLeft - 1)) return makeUsi(r);
      }
    } catch {
      /* too big to search here */
    }
    return undefined;
  }

  private finish(): void {
    const clean = this.mistakes === 0 && !this.hinted;
    if (clean) markSolved(this.n, this.id);
    this.feedback = { kind: 'solved', clean };
    playSound('success');
    this.syncGround();
    this.redraw();
  }

  /** Take back the wrong move (and the defender's answer to it). */
  retry(): void {
    this.token++;
    this.busy = false;
    const keep = this.line.plies.findIndex((p, i) => p.color === 'sente' && p.usi !== this.puzzle.line[i]);
    this.line = this.line.undo(this.step - (keep < 0 ? this.step : keep));
    this.feedback = { kind: this.step ? 'good' : 'intro' };
    if (this.feedback.kind === 'good' && this.step) this.feedback.reply = this.line.plies[this.step - 1].western;
    this.ground.set({ drawable: { autoShapes: [] } });
    this.syncGround();
    this.redraw();
  }

  /** Mark where the next move starts: the piece on the board, or the piece in hand for a drop. */
  hint(): void {
    if (this.wrong) this.retry();
    if (!this.canMove) return;
    this.hinted = true;
    this.hintAt = this.step;
    const md = parseUsi(this.puzzle.line[this.step])!;
    const shape = isDrop(md) ? circle({ role: md.role, color: 'sente' } as Piece) : circle(makeSquareName(md.from));
    this.ground.set({ drawable: { autoShapes: [shape] } });
    this.redraw();
  }

  /** Give up: show the whole solution, to step through. */
  showSolution(): void {
    this.token++;
    this.busy = false;
    this.line = new Line(this.puzzle.sfen, this.puzzle.line);
    this.feedback = { kind: 'shown' };
    this.viewPly = 0;
    this.ground.set({ drawable: { autoShapes: [] } });
    this.syncGround();
    this.redraw();
  }

  view(ply: number | undefined): void {
    if (!this.done) return;
    const n = this.step;
    this.viewPly = ply === undefined || ply >= n ? undefined : Math.max(0, ply);
    this.syncGround();
    this.redraw();
  }

  stepView(delta: number): void {
    this.view((this.viewPly ?? this.step) + delta);
  }

  /** The hint's piece name, for the text beside the board. */
  hintRole(): { role: Role; drop: boolean } | undefined {
    if (this.hintAt !== this.step || !this.canMove) return undefined;
    const md = parseUsi(this.puzzle.line[this.step])!;
    if (isDrop(md)) return { role: md.role, drop: true };
    return { role: this.line.current.board.get(md.from)!.role, drop: false };
  }
}
