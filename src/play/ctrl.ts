// Shogi Israel: controller for a game against the computer. Plays the role of Lishogi's round controller
// (lila ui/round) for the parts a game against the computer needs: moves and drops with the promotion question,
// the computer's replies, takeback, flip, resign, the impasse declaration, an optional clock with byoyomi,
// and stepping back through the moves. Advanced analysis tools are left out on purpose.
// The game in progress is saved on this device, so a reload continues it.
// AGPL-3.0-or-later, like the rest of this site.
import type { Api } from 'shogiground/api';
import type { Config } from 'shogiground/config';
import { Shogiground } from 'shogiground/shogiground';
import type { Piece } from 'shogiground/types';
import { shogigroundDropDests, shogigroundMoveDests } from 'shogiops/compat';
import { makeSfen } from 'shogiops/sfen';
import type { Piece as OpsPiece, Role } from 'shogiops/types';
import { isDrop, makeSquareName, makeUsi, opposite, parseSquareName, parseUsi } from 'shogiops/util';
import { pieceCanPromote, pieceForcePromote, promote } from 'shogiops/variant/util';
import type { LearnPrefs } from '../learn/prefs';
import { play as playSound, playMove } from '../learn/sound';
import { storage } from '../learn/storage';
import { bookMove } from './book';
import { cancelSearches, getEngine } from './engine';
import { type GameEnd, Line, START_SFEN } from './game';
import { engineLabel, getLevel } from './levels';
import { type ClockSetting, CURRENT, type GameRecord, newGameId, saveFinished } from './record';
import { liveBounds } from '../lib/live-bounds';

export interface PlaySettings {
  level: number;
  color: Color | 'random';
  clock: ClockSetting | null;
}

interface Clock {
  setting: ClockSetting;
  main: Record<Color, number>; // ms of main time left
  running?: Color;
  since?: number; // performance.now() when the running side's turn began
}

interface Saved {
  record: GameRecord;
  clock: Clock | null;
  orientation: Color;
}

const SETTINGS = 'play.settings';
const MIN_REPLY_MS = 350; // a book move or a level-1 reply would otherwise land before the player's own move animates

export const defaultSettings = (): PlaySettings => ({ level: 1, color: 'sente', clock: null });

export function loadSettings(): PlaySettings {
  const s = defaultSettings();
  try {
    const saved = JSON.parse(storage.get(SETTINGS) || '{}');
    if (Number.isInteger(saved.level) && saved.level >= 1 && saved.level <= 10) s.level = saved.level;
    if (['sente', 'gote', 'random'].includes(saved.color)) s.color = saved.color;
    if (saved.clock && saved.clock.limit >= 0 && saved.clock.byoyomi >= 0) s.clock = saved.clock;
  } catch {
    /* defaults */
  }
  // /play/?level=3 (from a course step on /course/) preselects that level on the setup screen
  try {
    const asked = Number(new URLSearchParams(window.location.search).get('level'));
    if (Number.isInteger(asked) && asked >= 1 && asked <= 10) s.level = asked;
  } catch {
    /* no URL: keep the saved level */
  }
  return s;
}

export default class PlayCtrl {
  ground: Api;
  line: Line = new Line();
  record?: GameRecord; // undefined = no game yet (the setup screen is showing)
  settings: PlaySettings = loadSettings();
  clock: Clock | null = null;
  orientation: Color = 'sente';
  viewPly?: number; // stepping back through the moves; undefined = the live position
  thinking = false;
  engineError = false;
  setupOpen = true;
  resignConfirm = false;
  private aiToken = 0;
  private flagTimer?: number;

  constructor(
    readonly pref: LearnPrefs,
    readonly redraw: () => void,
  ) {
    this.ground = liveBounds(Shogiground(this.groundConfig()));
    this.resume();
  }

  // ---------------------------------------------------------------- state helpers

  get playerColor(): Color {
    return this.record?.playerColor ?? 'sente';
  }
  get aiColor(): Color {
    return opposite(this.playerColor);
  }
  get level() {
    return getLevel(this.record?.level ?? this.settings.level);
  }
  get ended(): GameEnd | undefined {
    return this.record?.result;
  }
  get live(): boolean {
    return this.viewPly === undefined;
  }
  get playing(): boolean {
    return !!this.record && !this.ended;
  }
  get myTurn(): boolean {
    return this.playing && this.line.current.turn === this.playerColor && !this.thinking;
  }
  /** Plies a takeback removes: back to the player's turn, before their last move. 0 = nothing to take back. */
  get takebackPlies(): number {
    if (!this.record) return 0;
    const n = this.line.current.turn === this.playerColor ? 2 : 1;
    const plies = this.line.plies;
    if (plies.length < n) return 0;
    // the player must have made the move being taken back
    if (plies[plies.length - n].color !== this.playerColor) return 0;
    return n;
  }
  get canDeclareImpasse(): boolean {
    return this.myTurn && this.live && this.line.canDeclareImpasse();
  }

  // ---------------------------------------------------------------- the board

  private groundConfig(): Config {
    return {
      orientation: this.orientation,
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
      coordinates: { enabled: true, files: 'numeric', ranks: 'numeric' }, // two-digit squares (76)
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

  /** Put the board in the state of the shown position. */
  syncGround(): void {
    const ply = this.viewPly ?? this.line.plies.length;
    const pos = this.line.positionAt(ply);
    const [board, , hands] = makeSfen(pos).split(' ');
    const canMove = this.live && this.myTurn;
    this.ground.set({
      sfen: { board, hands },
      orientation: this.orientation,
      turnColor: pos.turn,
      activeColor: this.live && this.playing ? this.playerColor : undefined,
      lastDests: this.lastDests(ply),
      checks: pos.isCheck(),
      movable: { dests: canMove ? shogigroundMoveDests(pos) : new Map() },
      droppable: { dests: canMove ? shogigroundDropDests(pos) : new Map() },
    });
  }

  private onUserMove(orig: Key, dest: Key, promotion: boolean): void {
    this.userPlays(makeUsi({ from: parseSquareName(orig)!, to: parseSquareName(dest)!, promotion }));
  }

  private onUserDrop(piece: Piece, key: Key): void {
    this.userPlays(makeUsi({ role: piece.role as Role, to: parseSquareName(key)! }));
  }

  private userPlays(usi: string): void {
    if (!this.myTurn || !this.live || !this.line.isLegal(usi)) {
      this.syncGround();
      return;
    }
    this.apply(usi);
    if (this.playing) this.aiMove();
  }

  /** Play a move for whoever is to move, then check for the end of the game. */
  private apply(usi: string): void {
    this.switchClock();
    this.line = this.line.play(usi);
    this.record!.moves = this.line.usis;
    this.resignConfirm = false;
    const end = this.line.end();
    if (end) this.finish(end);
    else {
      this.save();
      if (this.line.current.isCheck()) playSound('check');
    }
    this.syncGround();
    this.redraw();
  }

  // ---------------------------------------------------------------- the computer

  private async aiMove(): Promise<void> {
    const token = ++this.aiToken;
    this.thinking = true;
    this.engineError = false;
    this.syncGround();
    this.redraw();
    const started = performance.now();
    const level = this.level;
    let usi: string | undefined;
    try {
      const fromBook = level.book && this.line.startSfen === START_SFEN ? bookMove(this.line.usis) : undefined;
      if (fromBook && this.line.isLegal(fromBook)) usi = fromBook;
      else {
        const engine = await getEngine(level.engine);
        if (token !== this.aiToken) return;
        const res = await engine.search(this.line.startSfen, this.line.usis, level);
        if (!res || token !== this.aiToken) return;
        usi = res.usi;
      }
    } catch (e) {
      console.error(e);
      if (token !== this.aiToken) return;
      this.thinking = false;
      this.engineError = true;
      this.redraw();
      return;
    }
    const wait = MIN_REPLY_MS - (performance.now() - started);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    if (token !== this.aiToken) return;
    this.thinking = false;

    if (usi === 'win' && this.line.canDeclareImpasse()) return this.finish({ reason: 'impasse', winner: this.aiColor }, true);
    if (!usi || usi === 'resign' || usi === 'win' || usi === '(none)' || !this.line.isLegal(usi)) {
      return this.finish({ reason: 'resign', winner: this.playerColor }, true);
    }
    // animate the move on the board, then apply() sets the exact position (hands included)
    const md = parseUsi(usi)!;
    if (isDrop(md)) this.ground.drop({ role: md.role, color: this.aiColor }, makeSquareName(md.to));
    else this.ground.move(makeSquareName(md.from), makeSquareName(md.to), md.promotion);
    this.apply(usi);
  }

  private stopAi(): void {
    this.aiToken++;
    this.thinking = false;
    cancelSearches();
  }

  /** Ask the computer again after the engine failed to load or answer. */
  retry(): void {
    if (this.playing && this.line.current.turn === this.aiColor && !this.thinking) this.aiMove();
  }

  /** Start downloading the engine for a level before the game needs it. */
  preload(level = this.settings.level): void {
    getEngine(getLevel(level).engine).catch(() => {});
  }

  // ---------------------------------------------------------------- game lifecycle

  start(settings: PlaySettings): void {
    this.stopAi();
    this.settings = settings;
    storage.set(SETTINGS, JSON.stringify(settings));
    const playerColor: Color = settings.color === 'random' ? (Math.random() < 0.5 ? 'sente' : 'gote') : settings.color;
    const level = getLevel(settings.level);
    this.line = new Line();
    this.record = {
      id: newGameId(),
      version: 1,
      startedAt: new Date().toISOString(),
      startSfen: START_SFEN,
      moves: [],
      playerColor,
      level: level.level,
      engine: engineLabel[level.engine],
      clock: settings.clock,
      takebacks: 0,
    };
    this.clock = settings.clock
      ? { setting: settings.clock, main: { sente: settings.clock.limit * 1000, gote: settings.clock.limit * 1000 } }
      : null;
    this.orientation = playerColor;
    this.viewPly = undefined;
    this.setupOpen = false;
    this.resignConfirm = false;
    this.engineError = false;
    this.startClock();
    this.save();
    this.syncGround();
    playSound('gameStart');
    this.redraw();
    if (this.line.current.turn !== playerColor) this.aiMove();
  }

  private finish(end: GameEnd, viaApply = false): void {
    if (!this.record) return;
    this.stopClock();
    this.thinking = false;
    this.record.result = end;
    this.record.endedAt = new Date().toISOString();
    this.record.moves = this.line.usis;
    this.resignConfirm = false;
    saveFinished({ ...this.record });
    this.save();
    playSound(end.winner === this.playerColor ? 'win' : end.winner ? 'lose' : 'end');
    if (viaApply) this.syncGround();
    this.redraw();
  }

  takeback(): void {
    const n = this.takebackPlies;
    if (!n || !this.record) return;
    this.stopAi();
    this.line = this.line.undo(n);
    this.record.moves = this.line.usis;
    this.record.takebacks++;
    if (this.record.result) {
      // the game goes on: it is no longer finished
      delete this.record.result;
      delete this.record.endedAt;
    }
    this.viewPly = undefined;
    this.resignConfirm = false;
    this.startClock();
    this.save();
    this.syncGround();
    this.redraw();
  }

  resign(): void {
    if (!this.playing) return;
    if (!this.resignConfirm) {
      this.resignConfirm = true;
      this.redraw();
      return;
    }
    this.stopAi();
    this.finish({ reason: 'resign', winner: this.aiColor }, true);
  }

  cancelResign(): void {
    this.resignConfirm = false;
    this.redraw();
  }

  declareImpasse(): void {
    if (!this.canDeclareImpasse) return;
    this.finish({ reason: 'impasse', winner: this.playerColor }, true);
  }

  flip(): void {
    this.orientation = opposite(this.orientation);
    this.save();
    this.syncGround();
    this.redraw();
    document.dispatchEvent(new CustomEvent('learn-level')); // keyboard cursor follows the turn of the board
  }

  openSetup(): void {
    this.setupOpen = true;
    this.redraw();
  }

  closeSetup(): void {
    if (!this.record) return; // nothing to go back to
    this.setupOpen = false;
    this.redraw();
  }

  /** Abandon the game in progress (it is not counted). */
  private discardCurrent(): void {
    this.stopAi();
    this.stopClock();
    storage.remove(CURRENT);
  }

  newGame(settings: PlaySettings): void {
    if (this.playing) this.discardCurrent();
    this.start(settings);
  }

  // ---------------------------------------------------------------- stepping through the moves

  view(ply: number | undefined): void {
    const last = this.line.plies.length;
    this.viewPly = ply === undefined || ply >= last ? undefined : Math.max(0, ply);
    this.syncGround();
    this.redraw();
  }
  step(delta: number): void {
    const cur = this.viewPly ?? this.line.plies.length;
    this.view(cur + delta);
  }

  // ---------------------------------------------------------------- clock (Japanese byoyomi)

  private startClock(): void {
    if (!this.clock || !this.playing) return;
    this.clock.running = this.line.current.turn;
    this.clock.since = performance.now();
    this.scheduleFlag();
  }

  private stopClock(): void {
    if (this.clock && this.clock.running) {
      this.clock.main[this.clock.running] = Math.max(0, this.timeLeft(this.clock.running).main);
      this.clock.running = undefined;
    }
    window.clearTimeout(this.flagTimer);
  }

  /** Called when a move is made: charge the mover, start the other side. */
  private switchClock(): void {
    if (!this.clock || !this.clock.running) return;
    const mover = this.clock.running;
    this.clock.main[mover] = Math.max(0, this.timeLeft(mover).main);
    this.clock.running = opposite(mover);
    this.clock.since = performance.now();
    this.scheduleFlag();
  }

  /** Main time and byoyomi left for a side, in ms. byo is only counting once main is 0. */
  timeLeft(color: Color): { main: number; byo: number } {
    const c = this.clock;
    if (!c) return { main: 0, byo: 0 };
    const byoMs = c.setting.byoyomi * 1000;
    const elapsed = c.running === color && c.since !== undefined ? performance.now() - c.since : 0;
    const main = c.main[color] - elapsed;
    if (main > 0) return { main, byo: byoMs };
    return { main: 0, byo: Math.max(0, byoMs + main) };
  }

  private scheduleFlag(): void {
    window.clearTimeout(this.flagTimer);
    const c = this.clock;
    if (!c || !c.running) return;
    const { main, byo } = this.timeLeft(c.running);
    this.flagTimer = window.setTimeout(() => {
      if (!this.clock?.running) return;
      const t = this.timeLeft(this.clock.running);
      if (t.main > 0 || t.byo > 0) return this.scheduleFlag();
      const loser = this.clock.running;
      this.stopAi();
      this.finish({ reason: 'time', winner: opposite(loser) }, true);
    }, main + byo + 20);
  }

  // ---------------------------------------------------------------- saving on this device

  private save(): void {
    if (!this.record) return;
    // the running side's time is saved as of now; a reload restarts that side's turn from here
    const clock = this.clock && {
      ...this.clock,
      main: { sente: Math.max(0, this.timeLeft('sente').main), gote: Math.max(0, this.timeLeft('gote').main) },
    };
    const saved: Saved = { record: this.record, clock, orientation: this.orientation };
    storage.set(CURRENT, JSON.stringify(saved));
  }

  private resume(): void {
    try {
      const saved = JSON.parse(storage.get(CURRENT) || 'null') as Saved | null;
      if (!saved?.record || saved.record.version !== 1) return;
      this.line = new Line(saved.record.startSfen, saved.record.moves);
      this.record = saved.record;
      this.clock = saved.clock ? { ...saved.clock, running: undefined, since: undefined } : null;
      this.orientation = saved.orientation ?? saved.record.playerColor;
      this.setupOpen = false;
      // /play/?new (the header's play button when no game is going on) opens the setup over a finished game
      if (!this.playing && new URLSearchParams(window.location.search).has('new')) this.setupOpen = true;
      if (this.playing) {
        this.startClock();
        if (this.line.current.turn !== this.playerColor) this.aiMove();
      }
    } catch (e) {
      console.warn('could not resume the saved game', e);
      storage.remove(CURRENT);
      this.line = new Line();
      this.record = undefined;
    }
  }
}
