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
import { play as playSound, playMove } from '../learn/sound';
import { Line } from '../play/game';
import { type Length, markSolved, type Puzzle, solvedList } from './puzzles';
import { legalMoves, Solver } from './solve';
import { liveBounds } from '../lib/live-bounds';
import { SQUARE_RATIO } from '../lib/square-ratio';

const REPLY_MS = 550;

export type Feedback =
  | { kind: 'intro' }
  | { kind: 'good'; reply?: string }
  | { kind: 'not-check' }
  | { kind: 'escape'; reply?: string }
  | { kind: 'solved'; clean: boolean }
  | { kind: 'shown' };

export default class TsumeCtrl {
  ground: Api;
  puzzle!: Puzzle;
  id = 1;
  line!: Line;
  feedback: Feedback = { kind: 'intro' };
  mistakes = 0;
  hinted = false;
  private hintAt?: number;
  busy = false;
  viewPly?: number;
  private token = 0;

  constructor(
    readonly n: Length,
    readonly puzzles: Puzzle[],
    readonly pref: LearnPrefs,
    readonly redraw: () => void,
  ) {
    this.ground = liveBounds(Shogiground(this.groundConfig()));
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

  private groundConfig(): Config {
    return {
      orientation: 'sente',
      squareRatio: SQUARE_RATIO,
      movable: { free: false, showDests: this.pref.dests, events: { after: (o, d, prom) => this.onUserMove(o, d, prom) } },
      droppable: { free: false, showDests: this.pref.dests, events: { after: (p, k) => this.onUserDrop(p, k) } },
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
        move: (_o, _d, promotion, captured) => playMove(!!captured, promotion),
        drop: () => playSound('drop'),
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
        if (!isDrop(md)) this.ground.set({ drawable: { autoShapes: [arrow(makeSquareName(md.from), makeSquareName(md.to), 'red')] } });
      } else this.feedback = { kind: 'good', reply: western };
      this.syncGround();
      this.redraw();
    }, REPLY_MS);
  }

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
    }
    return undefined;
  }

  private finish(): void {
    const clean = this.mistakes === 0 && !this.hinted;
    if (clean) markSolved(this.n, this.id);
    this.feedback = { kind: 'solved', clean };
    playSound('solved');
    this.syncGround();
    this.redraw();
  }

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

  hintRole(): { role: Role; drop: boolean } | undefined {
    if (this.hintAt !== this.step || !this.canMove) return undefined;
    const md = parseUsi(this.puzzle.line[this.step])!;
    if (isDrop(md)) return { role: md.role, drop: true };
    return { role: this.line.current.board.get(md.from)!.role, drop: false };
  }
}
