// AGPL-3.0-or-later, like the rest of this site.
import { makeKif, type KifEnd } from '../lib/kif.js';
import { type GameEnd, Line, START_SFEN } from '../play/game.js';

export type Speed = 'corr' | 'live';
export type Status = 'open' | 'active' | 'finished' | 'aborted' | 'cancelled';
export type EndReason = GameEnd['reason'] | 'abort';
export type Signal = 'gl' | 'gg' | 'ty' | 'again' | 'wait';
export type Reply = 'tb-yes' | 'tb-no' | 'end-no';
export interface Said { c: Color; k: Reply; at: string; p: number }
export interface Notes { c?: Color; m?: Signal; at?: string; end?: Color; re?: Said; ask?: string; rem?: number }

export const SIGNALS: Signal[] = ['gl', 'gg', 'ty', 'again', 'wait'];
export const CORR_DAYS = [3] as const;
export const GRACE_MS = 1000;
export const LIVE_START_MS = 3 * 60 * 1000;
export const INVITE_DAYS = 7;
export const MAX_SLOTS = 2;
export const GUEST_NAME = 'אורח';

export interface FriendRow {
  id: string;
  code: string;
  created_by: string | null;
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
  inviter_rest?: boolean;
  sente_rest?: boolean;
  gote_rest?: boolean;
  sente_name?: string | null;
  gote_name?: string | null;
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
  signal: Notes | null;
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

const IL_TIME = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jerusalem', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const REST = { from: 5 * 1440 + 14 * 60, to: 6 * 1440 + 22 * 60, resume: 7 * 1440 + 10 * 60 };

function weekMinute(at: number): number {
  const parts = IL_TIME.formatToParts(new Date(at));
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday')) * 1440 + Number(get('hour')) * 60 + Number(get('minute'));
}

export function inRest(at: number): boolean {
  const minute = weekMinute(at);
  return minute >= REST.from && minute < REST.to;
}

export function afterRest(at: number): number {
  const minute = weekMinute(at);
  if (minute < REST.from || minute >= REST.to) return at;
  return at - (at % 60_000) + (REST.resume - minute) * 60_000;
}

export const corrDeadline = (now: number, days: number, rest = false): string => iso(rest ? afterRest(now + days * 864e5) : now + days * 864e5);
export const rests = (row: FriendRow, side: Color): boolean => row[`${side}_rest`] === true;

export const REMIND_LEAD_MS = 12 * 3600 * 1000;
const remindKey = (row: FriendRow): number => Math.floor(ms(row.move_deadline) / 1000);

export function remindSide(row: FriendRow, now: number): Color | null {
  if (row.status !== 'active' || row.speed !== 'corr' || !row.move_deadline) return null;
  const due = ms(row.move_deadline);
  const side: Color = row.ply % 2 === 0 ? 'sente' : 'gote';
  if (due <= now || !row[`${side}_user`] || row.signal?.rem === remindKey(row)) return null;
  const rest = rests(row, side);
  if (rest && inRest(now)) return null;
  let next = now + 864e5;
  if (rest) while (inRest(next)) next += 864e5;
  return due - next < REMIND_LEAD_MS ? side : null;
}

export const remindedPatch = (row: FriendRow): Patch => ({ signal: { ...row.signal, rem: remindKey(row) } });

export const WATCH_GAP_MS = 3 * 60 * 1000;
export const watched = (row: FriendRow, now: number): boolean => row.ply > 0 && now - ms(row.turn_started_at) < WATCH_GAP_MS;

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

export function newInvite(input: { code: string; by: string; color: Color | 'random'; speed: Speed; days?: number; clock?: { limit: number; byo: number }; rest?: boolean }, now: number): Partial<FriendRow> {
  return {
    code: input.code,
    created_by: input.by,
    inviter_color: input.color,
    speed: input.speed,
    corr_days: input.speed === 'corr' ? input.days ?? 3 : null,
    clock_limit: input.speed === 'live' ? input.clock?.limit ?? 600 : null,
    clock_byo: input.speed === 'live' ? input.clock?.byo ?? 30 : null,
    status: 'open',
    start_sfen: START_SFEN,
    moves: [],
    ply: 0,
    expires_at: iso(now + INVITE_DAYS * 864e5),
    ...(input.rest ? { inviter_rest: true } : {}),
  };
}

export function validInvite(body: { speed?: unknown; days?: unknown; color?: unknown }): { speed: Speed; days?: number; color: Color | 'random' } | null {
  const color = body.color === 'sente' || body.color === 'gote' ? body.color : body.color === 'random' || body.color === undefined ? 'random' : null;
  if (!color) return null;
  if (body.speed === 'corr') {
    const days = Number(body.days ?? 3);
    return (CORR_DAYS as readonly number[]).includes(days) ? { speed: 'corr', days, color } : null;
  }
  return null;
}

export type InviteState = 'open' | 'mine' | 'taken' | 'expired' | 'cancelled' | 'player';

export function inviteState(row: FriendRow, seat: Seat, now: number): InviteState {
  if (sideOf(row, seat)) return 'player';
  if (row.status === 'cancelled') return 'cancelled';
  if (row.status !== 'open') return 'taken';
  if (!row.created_by) return 'cancelled';
  if (seat.user && seat.user === row.created_by) return 'mine';
  if (ms(row.expires_at) <= now) return 'expired';
  return 'open';
}

export function joinPatch(row: FriendRow, joiner: Seat, now: number, coin: () => boolean, rest = false, nick: { inviter?: string; joiner?: string } = {}): Patch {
  const inviterColor: Color = row.inviter_color === 'random' ? (coin() ? 'sente' : 'gote') : row.inviter_color;
  const joinerColor = other(inviterColor);
  const live = row.speed === 'live';
  const inviterRest = row.inviter_rest === true;
  return {
    ...(inviterRest ? { [`${inviterColor}_rest`]: true } : {}),
    ...(rest ? { [`${joinerColor}_rest`]: true } : {}),
    ...(nick.inviter ? { [`${inviterColor}_name`]: nick.inviter } : {}),
    ...(nick.joiner && joiner.user ? { [`${joinerColor}_name`]: nick.joiner } : {}),
    status: 'active',
    [`${inviterColor}_user`]: row.created_by,
    [`${joinerColor}_user`]: joiner.user ?? null,
    [`${joinerColor}_guest`]: joiner.user ? null : joiner.guest ?? null,
    sente_ms: live ? row.clock_limit! * 1000 : null,
    gote_ms: live ? row.clock_limit! * 1000 : null,
    turn_started_at: iso(now),
    move_deadline: live ? null : corrDeadline(now, row.corr_days!, inviterColor === 'sente' ? inviterRest : rest),
    started_at: iso(now),
  } as Patch;
}

export function claimPatch(row: FriendRow, user: string, guest: string | null | undefined, nick?: string): Patch | null {
  if (!guest || row.status === 'open' || row.status === 'cancelled') return null;
  const side: Color | null = row.sente_guest === guest && !row.sente_user ? 'sente' : row.gote_guest === guest && !row.gote_user ? 'gote' : null;
  if (!side || row[`${other(side)}_user`] === user) return null;
  return { [`${side}_user`]: user, [`${side}_guest`]: null, ...(nick ? { [`${side}_name`]: nick } : {}) } as Patch;
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
    kif: aborted && moves.length < 2 ? null : friendKif({ ...row, moves }, { reason: end.reason, winner: aborted ? null : end.winner ?? null }, names),
  };
}

const said = (row: FriendRow, c: Color, k: Reply, now: number, p: number): Notes => ({ ...row.signal, re: { c, k, at: iso(now), p } });
const without = (notes: Notes | null): Notes | null => {
  if (!notes) return null;
  const { end: _end, ...rest } = notes;
  return Object.keys(rest).length ? rest : null;
};

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
  if (row.speed === 'corr') patch.move_deadline = corrDeadline(now, row.corr_days!, rests(row, other(side)));
  if (row.takeback_by && row.takeback_by !== side) patch.signal = said(row, side, 'tb-no', now, next.plies.length);
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

export const refused = (re: Said | null | undefined, side: Color, k: Reply): boolean => !!re && re.k === k && re.c !== side;
export const takebackShut = (re: Said | null | undefined, side: Color, ply: number): boolean => refused(re, side, 'tb-no') && re!.p === ply;
export const endShut = (re: Said | null | undefined, side: Color, ply: number): boolean => refused(re, side, 'end-no') && ply - re!.p < 2;

export function takebackAsk(row: FriendRow, side: Color): Patch | null {
  if (!takebackPlies(row, side) || row.takeback_by || takebackShut(row.signal?.re, side, row.ply)) return null;
  return { takeback_by: side };
}

export function takebackCancel(row: FriendRow, side: Color): Patch | null {
  return row.status === 'active' && row.takeback_by === side ? { takeback_by: null } : null;
}

export function takebackAnswer(row: FriendRow, side: Color, yes: boolean, now: number): Patch | null {
  if (row.status !== 'active' || !row.takeback_by || row.takeback_by === side) return null;
  const n = yes ? takebackPlies(row, row.takeback_by) : 0;
  if (!n) return { takeback_by: null, signal: said(row, side, 'tb-no', now, row.ply) };
  const moves = row.moves.slice(0, row.moves.length - n);
  const patch: Patch = { moves, ply: moves.length, takeback_by: null, turn_started_at: iso(now), signal: said(row, side, 'tb-yes', now, moves.length) };
  if (row.speed === 'corr') patch.move_deadline = corrDeadline(now, row.corr_days!, rests(row, moves.length % 2 === 0 ? 'sente' : 'gote'));
  return patch;
}

export function endAsk(row: FriendRow, side: Color): Patch | null {
  if (row.status !== 'active' || row.ply < 2 || row.signal?.end || endShut(row.signal?.re, side, row.ply)) return null;
  return { signal: { ...row.signal, end: side } };
}

export function endCancel(row: FriendRow, side: Color): Patch | null {
  return row.status === 'active' && row.signal?.end === side ? { signal: without(row.signal) } : null;
}

export function endAnswer(row: FriendRow, side: Color, yes: boolean, now: number, names: Names): Patch | null {
  if (row.status !== 'active' || !row.signal?.end || row.signal.end === side) return null;
  if (!yes) return { signal: { ...without(row.signal), re: { c: side, k: 'end-no', at: iso(now), p: row.ply } } };
  return { ...finish(row, { reason: 'abort' }, now, names), signal: without(row.signal) };
}

export function restPatch(row: FriendRow, side: Color, on: boolean): Patch | null {
  if (row.status !== 'active' || rests(row, side) === on) return null;
  const patch = { [`${side}_rest`]: on } as Patch;
  const turn: Color = row.ply % 2 === 0 ? 'sente' : 'gote';
  if (on && row.speed === 'corr' && turn === side && row.move_deadline) {
    const moved = afterRest(ms(row.move_deadline));
    if (moved !== ms(row.move_deadline)) patch.move_deadline = iso(moved);
  }
  return patch;
}

export function signalPatch(row: FriendRow, side: Color, m: Signal, now: number): Patch | null {
  if (!SIGNALS.includes(m)) return null;
  if (row.signal?.at && row.signal.c === side && now - ms(row.signal.at) < 3000) return null;
  return { signal: { ...row.signal, c: side, m, at: iso(now) } };
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
    ...(row.gote_name ? { sente_name: row.gote_name } : {}),
    ...(row.sente_name ? { gote_name: row.sente_name } : {}),
    ...(rests(row, 'gote') ? { sente_rest: true } : {}),
    ...(rests(row, 'sente') ? { gote_rest: true } : {}),
    status: 'active',
    start_sfen: START_SFEN,
    moves: [],
    ply: 0,
    sente_ms: live ? row.clock_limit! * 1000 : null,
    gote_ms: live ? row.clock_limit! * 1000 : null,
    turn_started_at: iso(now),
    move_deadline: live ? null : corrDeadline(now, row.corr_days!, rests(row, 'gote')),
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
  rest: boolean;
  startSfen: string;
  moves: string[];
  ply: number;
  clock: ClockView | null;
  deadline: number | null;
  now: number;
  takebackBy: Color | null;
  endBy: Color | null;
  reply: Said | null;
  rematchBy: Color | null;
  rematchId: string | null;
  signal: { c: Color; m: Signal; at: string } | null;
  winner: Color | null;
  endReason: EndReason | null;
  startedAt: string | null;
  endedAt: string | null;
  kif: string | null;
  rev: number;
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
    rest: rests(row, you),
    startSfen: row.start_sfen,
    moves: row.moves,
    ply: row.ply,
    clock: clockAt(row, now),
    deadline: deadline(row),
    now,
    takebackBy: row.takeback_by,
    endBy: (row.status === 'active' && row.signal?.end) || null,
    reply: row.signal?.re ?? null,
    rematchBy: row.rematch_by,
    rematchId: row.rematch_id,
    signal: row.signal?.c && row.signal.m && row.signal.at ? { c: row.signal.c, m: row.signal.m, at: row.signal.at } : null,
    winner: row.winner,
    endReason: row.end_reason,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    kif: row.kif,
    rev: ms(row.updated_at),
  };
}

export type Ping = Partial<Record<'ply' | 'status' | 'usi' | 'deadline' | 'rev' | 'prev', unknown>>;

export const pingIsOld = (game: GameView, ping: Ping): boolean => typeof ping.rev === 'number' && ping.rev <= game.rev;

export function pingMove(game: GameView, ping: Ping): GameView | null {
  if (game.status !== 'active' || ping.status !== 'active' || game.speed !== 'corr') return null;
  if (typeof ping.rev !== 'number' || ping.prev !== game.rev || ping.ply !== game.ply + 1) return null;
  if (typeof ping.usi !== 'string' || ping.usi.length > 8 || typeof ping.deadline !== 'number') return null;
  const line = new Line(game.startSfen, game.moves);
  if (line.current.turn === game.you || !line.isLegal(ping.usi) || line.play(ping.usi).end()) return null;
  return { ...game, moves: [...game.moves, ping.usi], ply: game.ply + 1, takebackBy: null, deadline: ping.deadline, now: ping.rev };
}
