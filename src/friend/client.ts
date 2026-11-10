// AGPL-3.0-or-later, like the rest of this site.
import type { GameView, Signal } from './core';
import { accountsEnabled } from '../lib/account-config';

const SEATS = 'shogi-il.friend.seats';

export function readSeats(): Record<string, string> {
  try {
    const v = JSON.parse(localStorage.getItem(SEATS) || '{}');
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

export function seatFor(id: string): string | undefined {
  return readSeats()[id];
}

export function saveSeat(id: string, token: string): void {
  const all = readSeats();
  all[id] = token;
  const keep = Object.entries(all).slice(-40);
  try { localStorage.setItem(SEATS, JSON.stringify(Object.fromEntries(keep))); } catch { }
}

async function token(): Promise<string | null> {
  if (!accountsEnabled) return null;
  const { getSession } = await import('../lib/account');
  return (await getSession())?.access_token ?? null;
}

export async function signedIn(): Promise<boolean> {
  return !!(await token());
}

export interface ApiResult<T> { ok: boolean; status: number; error?: string; data: T }

export async function call<T = Record<string, unknown>>(action: string, body: Record<string, unknown> = {}): Promise<ApiResult<T>> {
  const t = await token();
  const id = typeof body.id === 'string' ? body.id : undefined;
  const seat = id ? seatFor(id) : undefined;
  try {
    const res = await fetch('/api/friend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) },
      body: JSON.stringify({ action, ...body, ...(seat ? { seat } : {}) }),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, error: data.error, data };
  } catch {
    return { ok: false, status: 0, error: 'network', data: {} as T };
  }
}

export interface InviteInfo {
  state: 'open' | 'mine' | 'taken' | 'expired' | 'cancelled' | 'player';
  id?: string;
  inviter: string;
  speed: 'corr' | 'live';
  days: number | null;
  clock: { limit: number; byo: number } | null;
  color: Color | 'random';
  expiresAt: string;
}

export interface ListedGame {
  id: string;
  code: string;
  status: GameView['status'];
  speed: GameView['speed'];
  days: number | null;
  clock: { limit: number; byo: number } | null;
  you: Color | null;
  names: { sente: string; gote: string };
  ply: number;
  winner: Color | null;
  endReason: GameView['endReason'];
  expiresAt: string;
  updatedAt: string;
  yourTurn: boolean;
  inviter: string;
  kif: string | null;
}

export const api = {
  create: (body: { speed: string; days?: number; clock?: { limit: number; byo: number }; color: string }) =>
    call<{ code: string; id: string }>('create', body),
  invite: (code: string) => call<InviteInfo>('invite', { code }),
  join: async (code: string) => {
    const r = await call<{ id: string; seat?: string }>('join', { code });
    if (r.ok && r.data.seat) saveSeat(r.data.id, r.data.seat);
    return r;
  },
  cancel: (code: string) => call('cancel', { code }),
  mine: () => call<{ games: ListedGame[]; now: number }>('mine'),
  state: (id: string) => call<{ game: GameView }>('state', { id }),
  move: (id: string, usi: string, ply: number) => call<{ game: GameView }>('move', { id, usi, ply }),
  resign: (id: string) => call<{ game: GameView }>('resign', { id }),
  impasse: (id: string) => call<{ game: GameView }>('impasse', { id }),
  takeback: (id: string, answer?: boolean) => call<{ game: GameView }>('takeback', { id, ...(answer === undefined ? {} : { answer }) }),
  signal: (id: string, m: Signal) => call<{ game: GameView }>('signal', { id, m }),
  rematch: async (id: string) => {
    const r = await call<{ game?: GameView; id?: string }>('rematch', { id });
    const seat = seatFor(id);
    if (r.ok && r.data.id && seat) saveSeat(r.data.id, seat);
    return r;
  },
  report: (id: string, reason: string) => call('report', { id, reason }),
  block: (id: string) => call('block', { id }),
};

export const inviteUrl = (code: string): string => `${location.origin}/friend/#${code}`;
export const gameUrl = (id: string): string => `/friend/game/#${id}`;

export const SPEED_TEXT = (speed: 'corr' | 'live', days: number | null, clock: { limit: number; byo: number } | null): string =>
  speed === 'corr'
    ? days === 3 ? 'משחק איטי: עד 3 ימים לכל מהלך' : 'משחק איטי: עד יום לכל מהלך'
    : `משחק חי: ${Math.round((clock?.limit ?? 600) / 60)} דק׳ + ${clock?.byo ?? 30} שנ׳ למהלך`;

export const SHORT_SPEED = (speed: 'corr' | 'live', days: number | null, clock: { limit: number; byo: number } | null): string =>
  speed === 'corr'
    ? `איטי, ${days === 3 ? '3 ימים' : 'יום'} למהלך`
    : `חי, ${Math.round((clock?.limit ?? 600) / 60)}+${clock?.byo ?? 30}`;

export const SIGNAL_TEXT: Record<Signal, string> = {
  gl: 'בהצלחה!',
  gg: 'משחק טוב!',
  ty: 'תודה!',
  again: 'עוד משחק?',
  wait: 'רק רגע…',
};
