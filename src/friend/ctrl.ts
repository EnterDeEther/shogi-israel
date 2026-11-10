// AGPL-3.0-or-later, like the rest of this site.
import type { Api } from 'shogiground/api';
import { Shogiground } from 'shogiground/shogiground';
import type { Piece } from 'shogiground/types';
import { shogigroundDropDests, shogigroundMoveDests } from 'shogiops/compat';
import { makeSfen } from 'shogiops/sfen';
import type { Piece as OpsPiece, Role } from 'shogiops/types';
import { isDrop, makeSquareName, makeUsi, parseSquareName, parseUsi } from 'shogiops/util';
import { pieceCanPromote, pieceForcePromote, promote } from 'shogiops/variant/util';
import type { LearnPrefs } from '../learn/prefs';
import { play as playSound, playMove } from '../learn/sound';
import { Line } from '../play/game';
import { liveBounds } from '../lib/live-bounds';
import { SQUARE_RATIO } from '../lib/square-ratio';
import { api } from './client';
import type { GameView, Signal } from './core';

export type LoadError = 'not-player' | 'no-game' | 'network' | null;

export default class FriendCtrl {
  ground: Api;
  game?: GameView;
  line: Line = new Line();
  viewPly?: number;
  receivedAt = 0;
  pending = false;
  loadError: LoadError = null;
  notice: string | null = null;
  resignConfirm = false;
  menu: 'messages' | 'safety' | null = null;
  reported = false;
  blocked = false;
  orientation: Color = 'sente';
  private noticeTimer?: number;
  private flagTimer?: number;
  private lastSignalAt?: string;

  constructor(
    readonly id: string,
    readonly pref: LearnPrefs,
    readonly redraw: () => void,
  ) {
    this.ground = liveBounds(Shogiground({
      orientation: this.orientation,
      squareRatio: SQUARE_RATIO,
      movable: { free: false, showDests: pref.dests, events: { after: (o, d, prom) => this.userPlays(makeUsi({ from: parseSquareName(o)!, to: parseSquareName(d)!, promotion: prom })) } },
      droppable: { free: false, showDests: pref.dests, events: { after: (p: Piece, k) => this.userPlays(makeUsi({ role: p.role as Role, to: parseSquareName(k)! })) } },
      promotion: {
        promotesTo: (role) => promote('standard')(role as Role),
        movePromotionDialog: (orig: Key, dest: Key) => {
          const piece = this.ground.state.pieces.get(orig) as OpsPiece | undefined;
          return !!piece && pieceCanPromote('standard')(piece, parseSquareName(orig)!, parseSquareName(dest)!, undefined) &&
            !pieceForcePromote('standard')(piece, parseSquareName(dest)!);
        },
        forceMovePromotion: (orig: Key, dest: Key) => {
          const piece = this.ground.state.pieces.get(orig) as OpsPiece | undefined;
          return !!piece && pieceForcePromote('standard')(piece, parseSquareName(dest)!);
        },
      },
      premovable: { enabled: false },
      predroppable: { enabled: false },
      animation: { enabled: pref.animation },
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
    }));
  }

  get you(): Color {
    return this.game?.you ?? 'sente';
  }
  get opp(): Color {
    return this.you === 'sente' ? 'gote' : 'sente';
  }
  get active(): boolean {
    return this.game?.status === 'active';
  }
  get ended(): boolean {
    return this.game?.status === 'finished' || this.game?.status === 'aborted';
  }
  get live(): boolean {
    return this.viewPly === undefined;
  }
  get myTurn(): boolean {
    return this.active && !this.pending && this.line.current.turn === this.you;
  }
  get canTakeback(): boolean {
    if (!this.active || this.game?.takebackBy) return false;
    const plies = this.line.plies;
    const n = this.line.current.turn === this.you ? 2 : 1;
    return plies.length >= n && plies[plies.length - n].color === this.you;
  }
  get canImpasse(): boolean {
    return this.myTurn && this.live && this.line.canDeclareImpasse();
  }

  async load(): Promise<void> {
    const r = await api.state(this.id);
    if (!r.ok) {
      this.loadError = r.status === 403 ? 'not-player' : r.status === 404 ? 'no-game' : 'network';
      this.redraw();
      return;
    }
    this.loadError = null;
    this.apply(r.data.game);
  }

  apply(view: GameView): void {
    const before = this.game;
    const fresh = !before || before.id !== view.id;
    this.game = view;
    this.receivedAt = performance.now();
    this.line = new Line(view.startSfen, view.moves);
    if (fresh) this.orientation = view.you;
    if (this.viewPly !== undefined && this.viewPly >= this.line.plies.length) this.viewPly = undefined;
    if (!fresh && before) {
      const last = this.line.plies[this.line.plies.length - 1];
      if (view.ply > before.ply && last && last.color !== view.you) {
        const md = parseUsi(last.usi)!;
        if (isDrop(md)) playSound('drop');
        else playMove(last.capture, !!md.promotion);
        if (this.line.current.isCheck()) playSound('check');
      }
      if (before.status === 'active' && view.status !== 'active') playSound(view.winner === view.you ? 'win' : view.winner ? 'lose' : 'end');
      if (view.signal && view.signal.at !== this.lastSignalAt && view.signal.c !== view.you) this.flash(view.signal.m);
    } else if (fresh && view.status === 'active' && view.ply === 0) playSound('gameStart');
    if (fresh && view.signal && view.signal.c !== view.you && view.now - Date.parse(view.signal.at) < 30_000) this.flash(view.signal.m);
    this.lastSignalAt = view.signal?.at;
    this.syncGround();
    this.scheduleFlag();
    this.redraw();
  }

  private flash(m: Signal): void {
    this.notice = m;
    window.clearTimeout(this.noticeTimer);
    this.noticeTimer = window.setTimeout(() => { this.notice = null; this.redraw(); }, 6000);
  }

  syncGround(): void {
    const ply = this.viewPly ?? this.line.plies.length;
    const pos = this.line.positionAt(ply);
    const [board, , hands] = makeSfen(pos).split(' ');
    const canMove = this.live && this.myTurn;
    const last = ply > 0 ? parseUsi(this.line.plies[ply - 1].usi) : undefined;
    this.ground.set({
      sfen: { board, hands },
      orientation: this.orientation,
      turnColor: pos.turn,
      activeColor: this.live && this.active ? this.you : undefined,
      lastDests: last ? (isDrop(last) ? [makeSquareName(last.to)] : [makeSquareName(last.from), makeSquareName(last.to)]) : [],
      checks: pos.isCheck(),
      movable: { dests: canMove ? shogigroundMoveDests(pos) : new Map() },
      droppable: { dests: canMove ? shogigroundDropDests(pos) : new Map() },
    });
  }

  private async userPlays(usi: string): Promise<void> {
    if (!this.myTurn || !this.live || !this.line.isLegal(usi) || !this.game) {
      this.syncGround();
      return;
    }
    const ply = this.game.ply;
    this.line = this.line.play(usi);
    this.pending = true;
    this.resignConfirm = false;
    if (this.line.current.isCheck()) playSound('check');
    this.syncGround();
    this.redraw();
    const r = await api.move(this.id, usi, ply);
    this.pending = false;
    if (r.data.game) this.apply(r.data.game);
    else await this.load();
  }

  timeLeft(color: Color): { main: number; byo: number } {
    const c = this.game?.clock;
    if (!c) return { main: 0, byo: 0 };
    const elapsed = c.running === color ? performance.now() - this.receivedAt : 0;
    const left = c[color] - elapsed;
    return left > 0 ? { main: left, byo: c.byo } : { main: 0, byo: Math.max(0, c.byo + left) };
  }

  deadlineLeft(): number | null {
    const g = this.game;
    if (!g || g.deadline === null) return null;
    return g.deadline - g.now - (performance.now() - this.receivedAt);
  }

  private scheduleFlag(): void {
    window.clearTimeout(this.flagTimer);
    const left = this.deadlineLeft();
    if (left === null || !this.active) return;
    if (left > 2 ** 31 - 1) return;
    this.flagTimer = window.setTimeout(() => void this.load(), Math.max(1500, left + 1500));
  }

  view(ply: number | undefined): void {
    const last = this.line.plies.length;
    this.viewPly = ply === undefined || ply >= last ? undefined : Math.max(0, ply);
    this.syncGround();
    this.redraw();
  }
  step(delta: number): void {
    this.view((this.viewPly ?? this.line.plies.length) + delta);
  }

  flip(): void {
    this.orientation = this.orientation === 'sente' ? 'gote' : 'sente';
    this.syncGround();
    this.redraw();
  }

  private async act(p: Promise<{ ok: boolean; data: { game?: GameView } }>): Promise<void> {
    this.pending = true;
    this.redraw();
    const r = await p;
    this.pending = false;
    if (r.data.game) this.apply(r.data.game);
    else await this.load();
  }

  resign(): void {
    if (!this.active) return;
    if (!this.resignConfirm) {
      this.resignConfirm = true;
      this.redraw();
      return;
    }
    this.resignConfirm = false;
    void this.act(api.resign(this.id));
  }
  cancelResign(): void {
    this.resignConfirm = false;
    this.redraw();
  }
  declareImpasse(): void {
    if (this.canImpasse) void this.act(api.impasse(this.id));
  }
  askTakeback(): void {
    if (this.canTakeback) void this.act(api.takeback(this.id));
  }
  answerTakeback(yes: boolean): void {
    void this.act(api.takeback(this.id, yes));
  }
  send(m: Signal): void {
    this.menu = null;
    void this.act(api.signal(this.id, m));
  }
  async rematch(): Promise<string | null> {
    const r = await api.rematch(this.id);
    if (r.data.id) return r.data.id;
    if (r.data.game) this.apply(r.data.game);
    return null;
  }
  async report(reason: string): Promise<void> {
    await api.report(this.id, reason);
    this.reported = true;
    this.redraw();
  }
  async block(): Promise<void> {
    await api.block(this.id);
    this.blocked = true;
    await this.load();
  }
}
