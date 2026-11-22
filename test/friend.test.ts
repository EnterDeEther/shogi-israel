import { describe, expect, test } from 'bun:test';
import { turnEmail, turnPush } from '../src/friend/alerts';
import {
  afterRest, claimPatch, clockAt, type FriendRow, gameView, inRest, inviteState, joinPatch, movePatch, newCode, newInvite, pingIsOld, pingMove, rematchAsk, rematchRow, resignPatch,
  restPatch, settle, signalPatch, takebackAnswer, takebackAsk, validInvite,
} from '../src/friend/core';

const T0 = Date.parse('2026-11-10T10:00:00Z');
const names = { sente: 'דין', gote: 'אורח' };

function row(over: Partial<FriendRow> = {}): FriendRow {
  const base = newInvite({ code: 'abcdefghij', by: 'u1', color: 'sente', speed: 'corr', days: 1 }, T0);
  const defaults: Partial<FriendRow> = {
    id: 'g1', rematch_of: null, sente_user: null, gote_user: null, sente_guest: null, gote_guest: null, sente_ms: null, gote_ms: null,
    turn_started_at: null, move_deadline: null, takeback_by: null, rematch_by: null, rematch_id: null, signal: null, winner: null,
    end_reason: null, kif: null, created_at: new Date(T0).toISOString(), started_at: null, ended_at: null, updated_at: new Date(T0).toISOString(),
  };
  return { ...defaults, ...base, ...over } as FriendRow;
}

const join = (r: FriendRow, seat = { guest: 'h'.repeat(64) }, now = T0) => ({ ...r, ...joinPatch(r, seat, now, () => true) }) as FriendRow;
const play = (r: FriendRow, side: 'sente' | 'gote', usi: string, now: number) => {
  const p = movePatch(r, side, usi, r.ply, now, names);
  if (typeof p === 'string') throw new Error(p);
  return { ...r, ...p } as FriendRow;
};

describe('invites', () => {
  test('codes use the safe alphabet and length', () => {
    const code = newCode((n) => Uint8Array.from({ length: n }, (_, i) => i * 37));
    expect(code).toMatch(/^[a-z0-9]{10}$/);
  });
  test('only the offered speeds and clocks are accepted', () => {
    expect(validInvite({ speed: 'corr', days: 3 })).toEqual({ speed: 'corr', days: 3, color: 'random' });
    expect(validInvite({ speed: 'corr', days: 2 })).toBeNull();
    expect(validInvite({ speed: 'live', clock: { limit: 600, byo: 30 }, color: 'gote' })).toEqual({ speed: 'live', clock: { limit: 600, byo: 30 }, color: 'gote' });
    expect(validInvite({ speed: 'live', clock: { limit: 5, byo: 0 } })).toBeNull();
    expect(validInvite({ speed: 'blitz' })).toBeNull();
  });
  test('the invite says who may join', () => {
    const r = row();
    expect(inviteState(r, { user: 'u1' }, T0)).toBe('mine');
    expect(inviteState(r, { user: 'u2' }, T0)).toBe('open');
    expect(inviteState(r, {}, T0 + 8 * 864e5)).toBe('expired');
    expect(inviteState({ ...r, status: 'cancelled' }, {}, T0)).toBe('cancelled');
    const j = join(r);
    expect(inviteState(j, { guest: 'h'.repeat(64) }, T0)).toBe('player');
    expect(inviteState(j, { user: 'u3' }, T0)).toBe('taken');
  });
  test('joining seats the inviter on the chosen side', () => {
    const j = join(row({ inviter_color: 'gote' }));
    expect(j.gote_user).toBe('u1');
    expect(j.sente_guest).toBe('h'.repeat(64));
    expect(j.status).toBe('active');
  });
});

describe('moves', () => {
  test('a legal move on your turn is saved and resets the day', () => {
    const j = join(row());
    const after = play(j, 'sente', '7g7f', T0 + 1000);
    expect(after.moves).toEqual(['7g7f']);
    expect(after.ply).toBe(1);
    expect(Date.parse(after.move_deadline!)).toBe(T0 + 1000 + 864e5);
  });
  test('wrong turn, stale ply and illegal moves are refused', () => {
    const j = join(row());
    expect(movePatch(j, 'gote', '3c3d', 0, T0, names)).toBe('not-your-turn');
    expect(movePatch(j, 'sente', '7g7f', 1, T0, names)).toBe('stale');
    expect(movePatch(j, 'sente', '7g7e', 0, T0, names)).toBe('illegal');
    expect(movePatch(row(), 'sente', '7g7f', 0, T0, names)).toBe('not-active');
  });
  test('checkmate ends the game with a KIF', () => {
    const g = join(row({ start_sfen: '4k4/9/4P4/9/9/9/9/9/4K4 b G 1' }));
    const done = play(g, 'sente', 'G*5b', T0);
    expect(done.status).toBe('finished');
    expect(done.winner).toBe('sente');
    expect(done.end_reason).toBe('mate');
    expect(done.kif).toContain('詰み');
  });
});

describe('time', () => {
  test('a slow game ends on time when the day passes', () => {
    let g = join(row());
    g = play(g, 'sente', '7g7f', T0);
    g = play(g, 'gote', '3c3d', T0 + 1000);
    expect(settle(g, T0 + 1000 + 864e5 - 1, names)).toBeNull();
    const out = settle(g, T0 + 1000 + 864e5 + 1, names)!;
    expect(out.status).toBe('finished');
    expect(out.winner).toBe('gote');
    expect(out.end_reason).toBe('time');
  });
  test('a game nobody started is cancelled, not lost', () => {
    const g = join(row());
    const out = settle(g, T0 + 864e5 + 1, names)!;
    expect(out.status).toBe('aborted');
    expect(out.winner).toBeNull();
  });
  test('live clocks start after both first moves and count down', () => {
    let g = join(row({ speed: 'live', corr_days: null, clock_limit: 600, clock_byo: 30 }));
    g = play(g, 'sente', '7g7f', T0 + 60_000);
    g = play(g, 'gote', '3c3d', T0 + 90_000);
    expect(g.sente_ms).toBe(600_000);
    expect(g.gote_ms).toBe(600_000);
    g = play(g, 'sente', '2g2f', T0 + 90_000 + 20_500);
    expect(g.sente_ms).toBe(580_000);
    const c = clockAt(g, T0 + 90_000 + 20_500 + 5_000)!;
    expect(c.running).toBe('gote');
    expect(c.gote).toBe(595_000);
  });
  test('a live game ends on time after main time and byoyomi', () => {
    let g = join(row({ speed: 'live', corr_days: null, clock_limit: 600, clock_byo: 30 }));
    g = play(g, 'sente', '7g7f', T0);
    g = play(g, 'gote', '3c3d', T0);
    expect(settle(g, T0 + 600_000 + 30_000, names)).toBeNull();
    const out = settle(g, T0 + 600_000 + 30_000 + 2_000, names)!;
    expect(out.winner).toBe('gote');
    expect(out.sente_ms).toBe(0);
    expect(movePatch(g, 'sente', '2g2f', 2, T0 + 700_000, names)).toBe('time');
  });
});

describe('etiquette', () => {
  test('resign before both moved cancels, later it loses', () => {
    const g = join(row());
    expect(resignPatch(g, 'sente', T0, names)!.status).toBe('aborted');
    const g2 = play(play(g, 'sente', '7g7f', T0), 'gote', '3c3d', T0);
    const out = resignPatch(g2, 'sente', T0, names)!;
    expect(out.winner).toBe('gote');
    expect(out.kif).toContain('投了');
  });
  test('a take-back needs the other side to agree', () => {
    let g = play(join(row()), 'sente', '7g7f', T0);
    expect(takebackAsk(g, 'gote')).toBeNull();
    g = { ...g, ...takebackAsk(g, 'sente') } as FriendRow;
    expect(takebackAnswer(g, 'sente', true, T0)).toBeNull();
    const back = takebackAnswer(g, 'gote', true, T0)!;
    expect(back.moves).toEqual([]);
    expect(takebackAnswer(g, 'gote', false, T0)).toEqual({ takeback_by: null });
  });
  test('fixed messages only, and not too often', () => {
    const g = join(row());
    expect(signalPatch(g, 'sente', 'gl', T0)!.signal!.m).toBe('gl');
    expect(signalPatch(g, 'sente', 'hello' as never, T0)).toBeNull();
    const s = { ...g, ...signalPatch(g, 'sente', 'gl', T0) } as FriendRow;
    expect(signalPatch(s, 'sente', 'gg', T0 + 1000)).toBeNull();
    expect(signalPatch(s, 'gote', 'gg', T0 + 1000)).not.toBeNull();
  });
  test('a rematch swaps the colours and keeps both seats', () => {
    const g = { ...join(row()), status: 'finished' } as FriendRow;
    const asked = { ...g, ...rematchAsk(g, 'gote') } as FriendRow;
    expect(rematchRow(asked, 'gote', 'kkkkkkkkkk', T0)).toBeNull();
    const next = rematchRow(asked, 'sente', 'kkkkkkkkkk', T0)!;
    expect(next.sente_guest).toBe(g.gote_guest);
    expect(next.gote_user).toBe(g.sente_user);
    expect(next.status).toBe('active');
  });
  test('the view never shows the other player\'s seat token', () => {
    const g = join(row());
    const v = gameView(g, 'gote', names, T0);
    expect(JSON.stringify(v)).not.toContain('h'.repeat(64));
    expect(v.guest.gote).toBe(true);
  });
});

describe('live pings', () => {
  const at = (r: FriendRow, t: number) => ({ ...r, updated_at: new Date(t).toISOString() }) as FriendRow;
  const start = at(join(row({ corr_days: 3 })), T0);
  const gote = gameView(start, 'gote', names, T0);
  const moved = at(play(start, 'sente', '7g7f', T0 + 5000), T0 + 5000);
  const ping = { ply: 1, status: 'active', usi: '7g7f', deadline: Date.parse(moved.move_deadline!), prev: T0, rev: T0 + 5000 };

  test('a view carries the time of its last change', () => {
    expect(gote.rev).toBe(T0);
    expect(gameView(moved, 'gote', names, T0 + 5000).rev).toBe(T0 + 5000);
  });
  test('a ping no newer than the view is old', () => {
    expect(pingIsOld(gote, { rev: T0 })).toBe(true);
    expect(pingIsOld(gote, { rev: T0 - 1 })).toBe(true);
    expect(pingIsOld(gote, { rev: T0 + 1 })).toBe(false);
    expect(pingIsOld(gote, { ply: 1, status: 'active' })).toBe(false);
  });
  test('the other side\'s move in a ping gives the same board as the server', () => {
    const hinted = pingMove(gote, ping)!;
    const real = gameView(moved, 'gote', names, T0 + 5000);
    expect(hinted.moves).toEqual(real.moves);
    expect(hinted.ply).toBe(real.ply);
    expect(hinted.deadline).toBe(real.deadline);
    expect(hinted.rev).toBe(gote.rev);
  });
  test('a ping is not applied when anything about it is off', () => {
    const sente = gameView(start, 'sente', names, T0);
    expect(pingMove(sente, ping)).toBeNull();
    expect(pingMove(gote, { ...ping, prev: T0 - 1 })).toBeNull();
    expect(pingMove(gote, { ...ping, ply: 2 })).toBeNull();
    expect(pingMove(gote, { ...ping, usi: '7g7e' })).toBeNull();
    expect(pingMove(gote, { ...ping, usi: null })).toBeNull();
    expect(pingMove(gote, { ...ping, status: 'finished' })).toBeNull();
    expect(pingMove(gote, { ...ping, deadline: null })).toBeNull();
    expect(pingMove(gote, { ply: 1, status: 'active' })).toBeNull();
    const live = at(join(row({ speed: 'live', corr_days: null, clock_limit: 600, clock_byo: 30 })), T0);
    expect(pingMove(gameView(live, 'gote', names, T0), ping)).toBeNull();
  });
});

describe('rest days', () => {
  const z = (iso: string) => Date.parse(iso);
  test('a deadline outside Friday afternoon to Saturday night stays put', () => {
    expect(afterRest(z('2026-11-13T11:59:30Z'))).toBe(z('2026-11-13T11:59:30Z'));
    expect(afterRest(z('2026-11-14T20:00:00Z'))).toBe(z('2026-11-14T20:00:00Z'));
    expect(afterRest(T0)).toBe(T0);
  });
  test('a deadline inside it moves to Sunday morning in Israel', () => {
    expect(afterRest(z('2026-11-13T12:00:00Z'))).toBe(z('2026-11-15T08:00:00Z'));
    expect(afterRest(z('2026-11-14T19:59:59Z'))).toBe(z('2026-11-15T08:00:00Z'));
    expect(afterRest(z('2026-07-11T09:00:00Z'))).toBe(z('2026-07-12T07:00:00Z'));
  });
  const wed = z('2026-11-11T14:00:00Z');
  const seat = { guest: 'h'.repeat(64) };
  test('nothing moves unless the player asked for it', () => {
    const g = play(join(row({ corr_days: 3 }), undefined, wed), 'sente', '7g7f', wed + 1000);
    expect(g.move_deadline).toBe('2026-11-14T14:00:01.000Z');
    expect(gameView(g, 'gote', names, wed).rest).toBe(false);
    expect(newInvite({ code: 'abcdefghij', by: 'u1', color: 'sente', speed: 'corr' }, T0)).not.toHaveProperty('inviter_rest');
    expect(joinPatch(row(), seat, T0, () => true)).not.toHaveProperty('gote_rest');
  });
  test('a joiner who rests gets until Sunday morning, the inviter does not', () => {
    const joined = { ...row({ corr_days: 3 }), ...joinPatch(row({ corr_days: 3 }), seat, wed, () => true, true) } as FriendRow;
    expect(joined.gote_rest).toBe(true);
    expect(joined.sente_rest).toBeUndefined();
    expect(joined.move_deadline).toBe('2026-11-14T14:00:00.000Z');
    const g = play(joined, 'sente', '7g7f', wed + 1000);
    expect(g.move_deadline).toBe('2026-11-15T08:00:00.000Z');
    const back = play(g, 'gote', '3c3d', wed + 2000);
    expect(back.move_deadline).toBe('2026-11-14T14:00:02.000Z');
    expect(gameView(g, 'gote', names, wed).rest).toBe(true);
    expect(gameView(g, 'sente', names, wed).rest).toBe(false);
  });
  test('an inviter who rests carries it into the seat and into a rematch', () => {
    const open = row({ corr_days: 3, ...newInvite({ code: 'abcdefghij', by: 'u1', color: 'sente', speed: 'corr', rest: true }, T0) });
    expect(open.inviter_rest).toBe(true);
    const g = { ...open, ...joinPatch(open, seat, wed, () => true) } as FriendRow;
    expect(g.sente_rest).toBe(true);
    expect(g.move_deadline).toBe('2026-11-15T08:00:00.000Z');
    const done = { ...g, ...resignPatch(play(play(g, 'sente', '7g7f', wed), 'gote', '3c3d', wed), 'sente', wed, names), rematch_by: 'sente' as const } as FriendRow;
    const again = rematchRow(done, 'gote', 'abcdefghij', wed)!;
    expect(again.gote_rest).toBe(true);
    expect(again).not.toHaveProperty('sente_rest');
    expect(again.move_deadline).toBe('2026-11-14T14:00:00.000Z');
  });
  test('switching it on mid-turn moves a deadline that falls inside, switching off never shortens', () => {
    const g = play(join(row({ corr_days: 3 }), undefined, wed), 'sente', '7g7f', wed);
    expect(restPatch(g, 'gote', true)).toEqual({ gote_rest: true, move_deadline: '2026-11-15T08:00:00.000Z' });
    expect(restPatch(g, 'sente', true)).toEqual({ sente_rest: true });
    const on = { ...g, ...restPatch(g, 'gote', true) } as FriendRow;
    expect(restPatch(on, 'gote', true)).toBeNull();
    expect(restPatch(on, 'gote', false)).toEqual({ gote_rest: false });
    expect(restPatch({ ...g, status: 'finished' }, 'gote', true)).toBeNull();
  });
  test('the quiet hours are Friday 14:00 to Saturday 22:00 in Israel', () => {
    expect(inRest(z('2026-11-13T11:59:00Z'))).toBe(false);
    expect(inRest(z('2026-11-13T12:00:00Z'))).toBe(true);
    expect(inRest(z('2026-11-14T19:59:00Z'))).toBe(true);
    expect(inRest(z('2026-11-14T20:00:00Z'))).toBe(false);
  });
});

describe('guest seats', () => {
  const seat = 'h'.repeat(64);
  test('a guest can move the seat into an account', () => {
    const g = join(row());
    expect(claimPatch(g, 'u2', seat)).toEqual({ gote_user: 'u2', gote_guest: null });
    const mine = { ...g, ...claimPatch(g, 'u2', seat) } as FriendRow;
    expect(gameView(mine, 'gote', names, T0).guest.gote).toBe(false);
  });
  test('not with a wrong seat, not twice, and not into the other player', () => {
    const g = join(row());
    expect(claimPatch(g, 'u2', 'x'.repeat(64))).toBeNull();
    expect(claimPatch(g, 'u2', null)).toBeNull();
    expect(claimPatch(g, 'u1', seat)).toBeNull();
    expect(claimPatch(row(), 'u2', seat)).toBeNull();
    const mine = { ...g, ...claimPatch(g, 'u2', seat) } as FriendRow;
    expect(claimPatch(mine, 'u3', seat)).toBeNull();
  });
  test('an invite whose owner is gone reads as cancelled', () => {
    expect(inviteState({ ...row(), created_by: null }, { user: 'u2' }, T0)).toBe('cancelled');
  });
});

describe('turn alerts', () => {
  test('the phone alert names the other player and opens the game', () => {
    const p = turnPush('יעל', 'abc');
    expect(p.title).toContain('יעל');
    expect(p.url).toBe('/friend/game/#abc');
    expect(p.tag).toBe('friend-abc');
  });
  test('the email has the game link, the deadline and a way out', () => {
    const m = turnEmail({ nickname: 'דין', opp: 'יעל', id: 'abc', deadline: Date.parse('2026-11-15T08:00:00Z'), gender: 'm', unsubscribeUrl: 'https://shogi.co.il/api/unsubscribe?u=1&k=turn&t=x' });
    expect(m.subject).toBe('תורך במשחק נגד יעל');
    expect(m.text).toContain('https://shogi.co.il/friend/game/?utm_source=email&utm_medium=email&utm_campaign=turn#abc');
    expect(m.text).toContain('10:00');
    expect(m.html).toContain('k=turn');
    expect(m.text).not.toContain('⟦');
  });
});
