// AGPL-3.0-or-later, like the rest of this site.
import { makeKif, type KifEnd } from '../lib/kif';
import { type GameEnd, Line, START_SFEN } from '../play/game';

export type Speed = 'corr' | 'live';
export type Status = 'open' | 'active' | 'finished' | 'aborted' | 'cancelled';
export type EndReason = GameEnd['reason'] | 'abort';
export type Signal = 'gl' | 'gg' | 'ty' | 'again' | 'wait';

export const SIGNALS: Signal[] = ['gl', 'gg', 'ty', 'again', 'wait'];
export const CORR_DAYS = [1, 3] as const;
export const LIVE_CLOCKS = [
  { limit: 600, byo: 30 },
  { limit: 300, byo: 10 },
  { limit: 1800, byo: 60 },
] as const;
export const GRACE_MS = 1000;
export const LIVE_START_MS = 3 * 60 * 1000;
export const INVITE_DAYS = 7;
export const MAX_OPEN_INVITES = 5;
export const GUEST_NAME = 'אורח';

export interface FriendRow {
  id: string;
  code: string;
  created_by: string;
  inviter_color: Color | 'random';
  rematch_of: string | null;
  speed: Speed;
  corr_days: number | null;
  clock_limit: number | null;
  clock_byo: number | null;
  sente_user: string | null;
  gote_user: string | null;
  sente_guest: string | null;
  gote_guest: string | null;
  status: Status;
  start_sfen: string;
  moves: string[];
  ply: number;
  sente_ms: number | null;
  gote_ms: number | null;
  turn_started_at: string | null;
  move_deadline: string | null;
  takeback_by: Color | null;
  rematch_by: Color | null;
  rematch_id: string | null;
  signal: { c: Color; m: Signal; at: string } | null;
  winner: Color | null;
  end_reason: EndReason | null;
  kif: string | null;
  expires_at: string;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
  updated_at: string;
}

export interface Seat {
  user?: string | null;
  guest?: string | null;
}

export type Patch = Partial<FriendRow>;

export const other = (c: Color): Color => (c === 'sente' ? 'gote' : 'sente');
const iso = (ms: number): string => new Date(ms).toISOString();
const ms = (s: string | null): number => (s ? Date.parse(s) : 0);

export function newCode(rand: (n: number) => Uint8Array): string {
  const abc = 'abcdefghijkmnpqrstuvwxyz23456789';
  return Array.from(rand(10), (b) => abc[b % abc.length]).join('');
}

export function sideOf(row: FriendRow, seat: Seat): Color | null {
  if (seat.user && row.sente_user === seat.user) return 'sente';
  if (seat.user && row.gote_user === seat.user) return 'gote';
  if (seat.guest && row.sente_guest === seat.guest) return 'sente';
  if (seat.guest && row.gote_guest === seat.guest) return 'gote';
  return null;
}

export function newInvite(input: { code: string; by: string; color: Color | 'random'; speed: Speed; days?: number; clock?: { limit: number; byo: number } }, now: number): Partial<FriendRow> {
  return {
    code: input.code,
    created_by: input.by,
    inviter_color: input.color,
    speed: input.speed,
    corr_days: input.speed === 'corr' ? input.days ?? 1 : null,
    clock_limit: input.speed === 'live' ? input.clock?.limit ?? 600 : null,
    clock_byo: input.speed === 'live' ? input.clock?.byo ?? 30 : null,
    status: 'open',
    start_sfen: START_SFEN,
    moves: [],
    ply: 0,
    expires_at: iso(now + INVITE_DAYS * 864e5),
  };
}

export function validInvite(body: { speed?: unknown; days?: unknown; clock?: unknown; color?: unknown }): { speed: Speed; days?: number; clock?: { limit: number; byo: number }; color: Color | 'random' } | null {
  const color = body.color === 'sente' || body.color === 'gote' ? body.color : body.color === 'random' || body.color === undefined ? 'random' : null;
  if (!color) return null;
  if (body.speed === 'corr') {
    const days = Number(body.days ?? 1);
    return (CORR_DAYS as readonly number[]).includes(days) ? { speed: 'corr', days, color } : null;
  }
  if (body.speed === 'live') {
    const c = body.clock as { limit?: unknown; byo?: unknown } | undefined;
    const found = LIVE_CLOCKS.find((k) => k.limit === Number(c?.limit ?? 600) && k.byo === Number(c?.byo ?? 30));
    return found ? { speed: 'live', clock: { limit: found.limit, byo: found.byo }, color } : null;
  }
  return null;
}

export type InviteState = 'open' | 'mine' | 'taken' | 'expired' | 'cancelled' | 'player';

export function inviteState(row: FriendRow, seat: Seat, now: number): InviteState {
  if (sideOf(row, seat)) return 'player';
  if (row.status === 'cancelled') return 'cancelled';
  if (row.status !== 'open') return 'taken';
  if (seat.user && seat.user === row.created_by) return 'mine';
  if (ms(row.expires_at) <= now) return 'expired';
  return 'open';
}

export function joinPatch(row: FriendRow, joiner: Seat, now: number, coin: () => boolean): Patch {
  const inviterColor: Color = row.inviter_color === 'random' ? (coin() ? 'sente' : 'gote') : row.inviter_color;
  const joinerColor = other(inviterColor);
  const live = row.speed === 'live';
  return {
    status: 'active',
    [`${inviterColor}_user`]: row.created_by,
    [`${joinerColor}_user`]: joiner.user ?? null,
    [`${joinerColor}_guest`]: joiner.user ? null : joiner.guest ?? null,
    sente_ms: live ? row.clock_limit! * 1000 : null,
    gote_ms: live ? row.clock_limit! * 1000 : null,
    turn_started_at: iso(now),
    move_deadline: live ? null : iso(now + row.corr_days! * 864e5),
    started_at: iso(now),
  } as Patch;
}

export const lineOf = (row: Pick<FriendRow, 'start_sfen' | 'moves'>): Line => new Line(row.start_sfen, row.moves);

export interface ClockView {
  sente: number;
  gote: number;
  byo: number;
  running: Color | null;
}

export function clockAt(row: FriendRow, now: number): ClockView | null {
  if (row.speed !== 'live' || row.sente_ms === null || row.gote_ms === null) return null;
  const byo = row.clock_byo! * 1000;
  const view: ClockView = { sente: row.sente_ms, gote: row.gote_ms, byo, running: null };
  if (row.status !== 'active') return view;
  const turn: Color = row.ply % 2 === 0 ? 'sente' : 'gote';
  view.running = row.ply >= 2 ? turn : null;
  if (view.running) view[turn] = row[`${turn}_ms`]! - Math.max(0, now - ms(row.turn_started_at));
  return view;
}

function liveDeadline(row: FriendRow): number {
  const turn: Color = row.ply % 2 === 0 ? 'sente' : 'gote';
  if (row.ply < 2) return ms(row.turn_started_at) + LIVE_START_MS;
  return ms(row.turn_started_at) + Math.max(0, row[`${turn}_ms`]!) + row.clock_byo! * 1000 + GRACE_MS;
}

export function deadline(row: FriendRow): number | null {
  if (row.status !== 'active') return null;
  return row.speed === 'live' ? liveDeadline(row) : ms(row.move_deadline);
}

function finish(row: FriendRow, end: { reason: EndReason; winner?: Color | null }, now: number, names: Names, moves = row.moves): Patch {
  const aborted = end.reason === 'abort';
  return {
    status: aborted ? 'aborted' : 'finished',
    winner: aborted ? null : end.winner ?? null,
    end_reason: end.reason,
    ended_at: iso(now),
    takeback_by: null,
    kif: aborted ? null : friendKif({ ...row, moves }, { reason: end.reason, winner: end.winner ?? null }, names),
  };
}

export interface Names {
  sente: string;
  gote: string;
}

export function settle(row: FriendRow, now: number, names: Names): Patch | null {
  const d = deadline(row);
  if (d === null || now <= d) return null;
  const turn: Color = row.ply % 2 === 0 ? 'sente' : 'gote';
  if (row.ply < 2) return finish(row, { reason: 'abort' }, now, names);
  return { ...finish(row, { reason: 'time', winner: other(turn) }, now, names), ...(row.speed === 'live' ? { [`${turn}_ms`]: 0 } : {}) };
}

export type MoveError = 'not-active' | 'not-your-turn' | 'stale' | 'illegal' | 'time';

export function movePatch(row: FriendRow, side: Color, usi: string, expectedPly: number, now: number, names: Names): Patch | MoveError {
  if (row.status !== 'active') return 'not-active';
  if (expectedPly !== row.ply) return 'stale';
  const line = lineOf(row);
  if (line.current.turn !== side) return 'not-your-turn';
  if (!line.isLegal(usi)) return 'illegal';
  const late = settle(row, now, names);
  if (late) return 'time';
  const next = line.play(usi);
  const patch: Patch = { moves: next.usis, ply: next.plies.length, takeback_by: null, turn_started_at: iso(now) };
  if (row.speed === 'live' && row.ply >= 2) {
    const spent = Math.max(0, now - ms(row.turn_started_at) - GRACE_MS / 2);
    patch[`${side}_ms`] = Math.max(0, row[`${side}_ms`]! - spent);
  }
  if (row.speed === 'corr') patch.move_deadline = iso(now + row.corr_days! * 864e5);
  const end = next.end();
  if (end) Object.assign(patch, finish(row, end, now, names, next.usis));
  return patch;
}

export function resignPatch(row: FriendRow, side: Color, now: number, names: Names): Patch | null {
  if (row.status !== 'active') return null;
  if (row.ply < 2) return finish(row, { reason: 'abort' }, now, names);
  return finish(row, { reason: 'resign', winner: other(side) }, now, names);
}

export function impassePatch(row: FriendRow, side: Color, now: number, names: Names): Patch | null {
  if (row.status !== 'active') return null;
  const line = lineOf(row);
  if (line.current.turn !== side || !line.canDeclareImpasse()) return null;
  return finish(row, { reason: 'impasse', winner: side }, now, names);
}

export function takebackPlies(row: FriendRow, side: Color): number {
  if (row.status !== 'active' || !row.ply) return 0;
  const line = lineOf(row);
  const n = line.current.turn === side ? 2 : 1;
  if (line.plies.length < n || line.plies[line.plies.length - n].color !== side) return 0;
  return n;
}

export function takebackAsk(row: FriendRow, side: Color): Patch | null {
  if (!takebackPlies(row, side) || row.takeback_by) return null;
  return { takeback_by: side };
}

export function takebackAnswer(row: FriendRow, side: Color, yes: boolean, now: number): Patch | null {
  if (row.status !== 'active' || !row.takeback_by || row.takeback_by === side) return null;
  if (!yes) return { takeback_by: null };
  const n = takebackPlies(row, row.takeback_by);
  if (!n) return { takeback_by: null };
  const moves = row.moves.slice(0, row.moves.length - n);
  const patch: Patch = { moves, ply: moves.length, takeback_by: null, turn_started_at: iso(now) };
  if (row.speed === 'corr') patch.move_deadline = iso(now + row.corr_days! * 864e5);
  return patch;
}

export function signalPatch(row: FriendRow, side: Color, m: Signal, now: number): Patch | null {
  if (!SIGNALS.includes(m)) return null;
  if (row.signal && row.signal.c === side && now - ms(row.signal.at) < 3000) return null;
  return { signal: { c: side, m, at: iso(now) } };
}

export function rematchAsk(row: FriendRow, side: Color): Patch | null {
  if ((row.status !== 'finished' && row.status !== 'aborted') || row.rematch_id || row.rematch_by) return null;
  return { rematch_by: side };
}

export function rematchRow(row: FriendRow, side: Color, code: string, now: number): Partial<FriendRow> | null {
  if (!row.rematch_by || row.rematch_by === side || row.rematch_id) return null;
  const live = row.speed === 'live';
  return {
    code,
    created_by: row.created_by,
    inviter_color: row.sente_user === row.created_by ? 'gote' : 'sente',
    rematch_of: row.id,
    speed: row.speed,
    corr_days: row.corr_days,
    clock_limit: row.clock_limit,
    clock_byo: row.clock_byo,
    sente_user: row.gote_user,
    gote_user: row.sente_user,
    sente_guest: row.gote_guest,
    gote_guest: row.sente_guest,
    status: 'active',
    start_sfen: START_SFEN,
    moves: [],
    ply: 0,
    sente_ms: live ? row.clock_limit! * 1000 : null,
    gote_ms: live ? row.clock_limit! * 1000 : null,
    turn_started_at: iso(now),
    move_deadline: live ? null : iso(now + row.corr_days! * 864e5),
    started_at: iso(now),
    expires_at: iso(now),
  };
}

const KIF_REASON: Record<EndReason, KifEnd['reason']> = {
  mate: 'checkmate', stalemate: 'checkmate', resign: 'resign', time: 'timeout', repetition: 'repetition',
  perpetual: 'repetition', impasse: 'impasse', draw: 'repetition', agreement: 'repetition', abort: 'abort',
};

export function friendKif(row: Pick<FriendRow, 'start_sfen' | 'moves' | 'started_at' | 'created_at'>, end: { reason: EndReason; winner: Color | null } | null, names: Names): string {
  return makeKif({
    startSfen: row.start_sfen,
    moves: row.moves,
    sente: names.sente,
    gote: names.gote,
    date: new Date(row.started_at ?? row.created_at),
    event: 'משחק עם חבר',
    end: end ? { reason: KIF_REASON[end.reason], winner: end.winner ?? undefined } : undefined,
  });
}

export interface GameView {
  id: string;
  code: string;
  status: Status;
  speed: Speed;
  days: number | null;
  clockSet: { limit: number; byo: number } | null;
  you: Color;
  names: Names;
  guest: { sente: boolean; gote: boolean };
  startSfen: string;
  moves: string[];
  ply: number;
  clock: ClockView | null;
  deadline: number | null;
  now: number;
  takebackBy: Color | null;
  rematchBy: Color | null;
  rematchId: string | null;
  signal: FriendRow['signal'];
  winner: Color | null;
  endReason: EndReason | null;
  startedAt: string | null;
  endedAt: string | null;
  kif: string | null;
}

export function gameView(row: FriendRow, you: Color, names: Names, now: number): GameView {
  return {
    id: row.id,
    code: row.code,
    status: row.status,
    speed: row.speed,
    days: row.corr_days,
    clockSet: row.speed === 'live' && row.clock_limit !== null ? { limit: row.clock_limit, byo: row.clock_byo ?? 0 } : null,
    you,
    names,
    guest: { sente: !row.sente_user && !!row.sente_guest, gote: !row.gote_user && !!row.gote_guest },
    startSfen: row.start_sfen,
    moves: row.moves,
    ply: row.ply,
    clock: clockAt(row, now),
    deadline: deadline(row),
    now,
    takebackBy: row.takeback_by,
    rematchBy: row.rematch_by,
    rematchId: row.rematch_id,
    signal: row.signal,
    winner: row.winner,
    endReason: row.end_reason,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    kif: row.kif,
  };
}
