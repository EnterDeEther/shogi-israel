// AGPL-3.0-or-later, like the rest of this site.
import type { GameView, Signal } from './core';
import { accountsEnabled } from '../lib/account-config';

export { rememberedInvite, rememberInvite } from './pending';

const SEATS = 'shogi-il.friend.seats';

export function readSeats(): Record<string, string> {
  try {
    const v = JSON.parse(localStorage.getItem(SEATS) || '{}');
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

let offered: { id: string; token: string } | null = null;

export function seatFor(id: string): string | undefined {
  return readSeats()[id];
}

export function saveSeat(id: string, token: string): void {
  const all = readSeats();
  all[id] = token;
  const keep = Object.entries(all).slice(-40);
  try { localStorage.setItem(SEATS, JSON.stringify(Object.fromEntries(keep))); } catch { }
}

export function offerSeat(id: string, token: string): void {
  const kept = seatFor(id);
  if (!kept) saveSeat(id, token);
  else if (kept !== token) offered = { id, token };
}

export function forgetSeat(id: string): void {
  const all = readSeats();
  delete all[id];
  try { localStorage.setItem(SEATS, JSON.stringify(all)); } catch { }
}

const SEEN = 'shogi-il.friend.seen';

export function seenReply(id: string): string | undefined {
  try { return (JSON.parse(localStorage.getItem(SEEN) || '{}') as Record<string, string>)[id]; } catch { return undefined; }
}

export function markReply(id: string, at: string): void {
  try {
    const all = JSON.parse(localStorage.getItem(SEEN) || '{}') as Record<string, string>;
    all[id] = at;
    localStorage.setItem(SEEN, JSON.stringify(Object.fromEntries(Object.entries(all).slice(-40))));
  } catch { }
}

const REST = 'shogi-il.friend.rest';
export const REST_LABEL = 'לא לשחק בשבת';
export const REST_HINT = 'הזמן שלך למהלך לא ייגמר בין שישי ב־14:00 לשבת ב־22:00, וגם לא נשלח לך התראות בשעות האלה. הבחירה נשמרת במכשיר הזה למשחקים הבאים.';

export function restPref(): boolean {
  try { return localStorage.getItem(REST) === '1'; } catch { return false; }
}

export function setRestPref(on: boolean): void {
  try { if (on) localStorage.setItem(REST, '1'); else localStorage.removeItem(REST); } catch { }
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

export async function call<T = Record<string, unknown>>(action: string, body: Record<string, unknown> = {}, as?: string): Promise<ApiResult<T>> {
  const t = await token();
  const id = typeof body.id === 'string' ? body.id : undefined;
  const seat = as ?? (id ? seatFor(id) : undefined);
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
  waits?: 'end' | 'takeback' | 'rematch' | null;
}

export const api = {
  create: (body: { speed: string; days?: number; clock?: { limit: number; byo: number }; color: string }) =>
    call<{ code: string; id: string }>('create', { ...body, ...(restPref() ? { rest: true } : {}) }),
  invite: (code: string) => call<InviteInfo>('invite', { code }),
  join: async (code: string) => {
    const r = await call<{ id: string; seat?: string }>('join', { code, ...(restPref() ? { rest: true } : {}) });
    if (r.ok && r.data.seat) saveSeat(r.data.id, r.data.seat);
    return r;
  },
  cancel: (code: string) => call('cancel', { code }),
  mine: () => call<{ games: ListedGame[]; now: number }>('mine'),
  state: async (id: string) => {
    const r = await call<{ game: GameView }>('state', { id });
    if (offered?.id !== id || (!r.ok && r.status !== 403)) return r;
    const other = offered.token;
    offered = null;
    if (r.ok) return r;
    const again = await call<{ game: GameView }>('state', { id }, other);
    if (again.ok) saveSeat(id, other);
    return again.ok ? again : r;
  },
  move: (id: string, usi: string, ply: number) => call<{ game: GameView }>('move', { id, usi, ply }),
  rest: (id: string, on: boolean) => call<{ game: GameView }>('rest', { id, on }),
  resign: (id: string) => call<{ game: GameView }>('resign', { id }),
  impasse: (id: string) => call<{ game: GameView }>('impasse', { id }),
  takeback: (id: string, answer?: boolean | 'cancel') => call<{ game: GameView }>('takeback', { id, ...(answer === 'cancel' ? { cancel: true } : answer === undefined ? {} : { answer }) }),
  end: (id: string, answer?: boolean | 'cancel') => call<{ game: GameView }>('end', { id, ...(answer === 'cancel' ? { cancel: true } : answer === undefined ? {} : { answer }) }),
  signal: (id: string, m: Signal) => call<{ game: GameView }>('signal', { id, m }),
  rematch: async (id: string) => {
    const r = await call<{ game?: GameView; id?: string }>('rematch', { id });
    const seat = seatFor(id);
    if (r.ok && r.data.id && seat) saveSeat(r.data.id, seat);
    return r;
  },
  claim: async (id: string) => {
    const r = await call<{ game: GameView }>('claim', { id });
    if (r.ok) forgetSeat(id);
    return r;
  },
  report: (id: string, reason: string) => call('report', { id, reason }),
  block: (id: string) => call('block', { id }),
};

export const inviteUrl = (code: string): string => `${location.origin}/friend/#${code}`;
export const gameUrl = (id: string): string => `/friend/game/#${id}`;
export const endUrl = (id: string): string => `/friend/game/?end#${id}`;
export const personalUrl = (id: string): string | null => {
  const seat = seatFor(id);
  return seat ? `${location.origin}/friend/game/#${id}.${seat}` : null;
};

export const SPEED_TEXT = (speed: 'corr' | 'live', days: number | null, clock: { limit: number; byo: number } | null): string =>
  speed === 'corr'
    ? days === 1 ? 'משחק בלי שעון: עד יום לכל מהלך' : 'משחק בלי שעון: עד 3 ימים לכל מהלך'
    : `משחק חי: ${Math.round((clock?.limit ?? 600) / 60)} דק׳ + ${clock?.byo ?? 30} שנ׳ למהלך`;

export const SHORT_SPEED = (speed: 'corr' | 'live', days: number | null, clock: { limit: number; byo: number } | null): string =>
  speed === 'corr'
    ? `בלי שעון, ${days === 1 ? 'יום' : '3 ימים'} למהלך`
    : `חי, ${Math.round((clock?.limit ?? 600) / 60)}+${clock?.byo ?? 30}`;

export const SIGNAL_TEXT: Record<Signal, string> = {
  gl: 'בהצלחה!',
  gg: 'משחק טוב!',
  ty: 'תודה!',
  again: 'עוד משחק?',
  wait: 'רק רגע…',
};
