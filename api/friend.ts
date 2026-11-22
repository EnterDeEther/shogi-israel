import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createHash, randomBytes } from 'node:crypto';
import {
  claimPatch, endAnswer, endAsk, endCancel, type FriendRow, gameView, impassePatch, inviteState, joinPatch, MAX_SLOTS, movePatch, type Names, newCode,
  newInvite, other, type Patch, rematchAsk, rematchRow, resignPatch, restPatch, rests, type Seat, settle, sideOf, type Signal, signalPatch, takebackAnswer, takebackAsk,
  sfenAfter, takebackCancel, validInvite, watched,
} from '../src/friend/core.js';
import { type AlertKind, ASK_ALERT_GAP_MS } from '../src/friend/alerts.js';
import { type BlockedWord, blockedName, nameProblem, tidyName } from '../src/friend/names.js';
import { alertSide, namesOf, nicknames, unnamed } from '../src/friend/send.js';

const ALLOWED_ORIGIN = /^https:\/\/((www\.)?shogi\.co\.il|shogi-israel-[a-z0-9-]+-enterdeether\.vercel\.app)$/;
const REPORT_TO = 'contact@shogi.co.il';
const FROM = 'שוגי ישראל <noreply@shogi.co.il>';
const BUG_KINDS = ['move', 'sync', 'join', 'link', 'alert', 'other'];
const BUG_DAY = { all: 200, game: 6, loose: 30, mail: 40 };
const BUG_KEEP_MS = 90 * 864e5;

type Body = Record<string, unknown>;

const enabled = () => process.env.VERCEL_ENV !== 'production' || process.env.FRIEND_PLAY === '1';
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const fail = (error: string, status = 400) => json({ error }, status);

const WORDS_MS = 10 * 60 * 1000;
let words: { at: number; list: BlockedWord[] } | null = null;
async function blockedWords(client: SupabaseClient): Promise<BlockedWord[] | null> {
  if (words && Date.now() - words.at < WORDS_MS) return words.list;
  const { data, error } = await client.from('blocked_words').select('word, whole');
  if (error || !data) return null;
  words = { at: Date.now(), list: data as BlockedWord[] };
  return words.list;
}

function db(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
}

let gate = { at: 0, off: false };
async function paused(client: SupabaseClient): Promise<boolean> {
  if (Date.now() - gate.at < 30_000) return gate.off;
  const { data } = await client.from('site_switches').select('off').eq('name', 'friend_play').maybeSingle();
  gate = { at: Date.now(), off: (data as { off?: boolean } | null)?.off === true };
  return gate.off;
}

const hash = (token: string) => createHash('sha256').update(token).digest('hex');
const isCode = (v: unknown): v is string => typeof v === 'string' && /^[a-z0-9]{10}$/.test(v);
const isId = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f-]{36}$/.test(v);
const isSeatToken = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{43}$/.test(v);

async function userOf(client: SupabaseClient, request: Request): Promise<string | null> {
  const auth = request.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token || token.length > 4000) return null;
  const { data } = await client.auth.getUser(token);
  return data.user && !data.user.is_anonymous ? data.user.id : null;
}

async function load(client: SupabaseClient, by: 'id' | 'code', value: string): Promise<FriendRow | null> {
  const { data } = await client.from('friend_games').select('*').eq(by, value).maybeSingle();
  return (data as FriendRow | null) ?? null;
}

async function save(client: SupabaseClient, row: FriendRow, patch: Patch): Promise<FriendRow | null> {
  const { data, error } = await client.from('friend_games').update(patch).eq('id', row.id).eq('updated_at', row.updated_at).select('*').maybeSingle();
  if (error) console.error('friend: save failed', error.message);
  return (data as FriendRow | null) ?? null;
}

async function settled(client: SupabaseClient, row: FriendRow, names: Names, now: number): Promise<FriendRow> {
  const late = settle(row, now, names);
  if (!late) return row;
  return (await save(client, row, late)) ?? (await load(client, 'id', row.id)) ?? row;
}

async function insertWithCode(client: SupabaseClient, values: Partial<FriendRow>): Promise<FriendRow | null> {
  for (let i = 0; i < 4; i++) {
    const code = newCode((n) => randomBytes(n));
    const { data, error } = await client.from('friend_games').insert({ ...values, code }).select('*').maybeSingle();
    if (!error) return data as FriendRow;
    if (error.code !== '23505') { console.error('friend: insert failed', error.message); return null; }
  }
  return null;
}

async function blocked(client: SupabaseClient, a: string, b: string): Promise<boolean> {
  const { data } = await client.from('friend_blocks').select('user_id').or(`and(user_id.eq.${a},blocked.eq.${b}),and(user_id.eq.${b},blocked.eq.${a})`).limit(1);
  return !!data?.length;
}

async function slotsUsed(client: SupabaseClient, user: string, now: number): Promise<number> {
  const [running, waiting] = await Promise.all([
    client.from('friend_games').select('*').eq('status', 'active').or(`sente_user.eq.${user},gote_user.eq.${user}`).limit(12),
    client.from('friend_games').select('id', { count: 'exact', head: true }).eq('created_by', user).eq('status', 'open').gt('expires_at', new Date(now).toISOString()),
  ]);
  const rows = (running.data ?? []) as FriendRow[];
  const nick = await nicknames(client, rows.flatMap(unnamed));
  let used = waiting.count ?? 0;
  for (const r of rows) if ((await settled(client, r, namesOf(r, nick), now)).status === 'active') used++;
  return used;
}

async function sendReport(row: FriendRow, reason: string, names: Names, side: string): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return;
  const text = [
    `דיווח על משחק עם חבר (${reason})`,
    `משחק: ${row.id}`,
    `מדווח: ${side}`,
    `פותח: ${names.sente}, משיב: ${names.gote}`,
    `מהלכים: ${row.ply}`,
  ].join('\n');
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [process.env.ADMIN_REPORT_EMAIL || REPORT_TO], subject: 'דיווח במשחק עם חבר', text }),
  }).catch(() => {});
}

const clean = (v: unknown, max: number): string => (typeof v === 'string' ? [...v.replace(/[^\P{C}\n]/gu, ' ').trim()].slice(0, max).join('') : '');

async function sendBug(row: FriendRow | null, bug: { kind: string; note: string; context: string; agent: string; side: string | null; signed: boolean }): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return;
  const text = [
    `תקלה במשחק עם חבר (${bug.kind})`,
    bug.note ? `מה נכתב: ${bug.note}` : 'בלי תיאור',
    row ? `משחק: ${row.id}, מצב: ${row.status}, קצב: ${row.speed}, מהלכים: ${row.ply}` : 'בלי משחק',
    `צד: ${bug.side ?? '-'}, מחובר לחשבון: ${bug.signed ? 'כן' : 'לא'}`,
    `עמוד: ${bug.context || '-'}`,
    `דפדפן: ${bug.agent || '-'}`,
  ].join('\n');
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [process.env.ADMIN_REPORT_EMAIL || REPORT_TO], subject: 'תקלה במשחק עם חבר', text }),
  }).catch(() => {});
}

async function bug(client: SupabaseClient, request: Request, body: Body, seat: Seat, now: number): Promise<Response> {
  const kind = BUG_KINDS.includes(body.kind as string) ? (body.kind as string) : 'other';
  const byId = isId(body.id);
  const found = byId ? await load(client, 'id', body.id as string) : isCode(body.code) ? await load(client, 'code', body.code) : null;
  const side = found ? sideOf(found, seat) : null;
  const row = found && (side || !byId) ? found : null;
  const since = new Date(now - 864e5).toISOString();
  const recent = () => client.from('friend_bugs').select('id', { count: 'exact', head: true }).gt('created_at', since);
  const [all, own] = await Promise.all([recent(), row ? recent().eq('game_id', row.id) : recent().is('game_id', null)]);
  if (all.error || own.error) return fail('save', 500);
  if ((all.count ?? 0) >= BUG_DAY.all || (own.count ?? 0) >= (row ? BUG_DAY.game : BUG_DAY.loose)) return fail('too-many', 429);
  const entry = { kind, note: clean(body.note, 500), context: clean(body.context, 300), agent: clean(request.headers.get('user-agent'), 200), side, signed: !!seat.user };
  const { error } = await client.from('friend_bugs').insert({ game_id: row?.id ?? null, ...entry });
  if (error) return fail('save', 500);
  await client.from('friend_bugs').delete().lt('created_at', new Date(now - BUG_KEEP_MS).toISOString());
  if ((all.count ?? 0) < BUG_DAY.mail) await sendBug(row, entry);
  return json({ ok: true });
}

async function alertTurn(client: SupabaseClient, row: FriendRow, names: Names, now: number): Promise<void> {
  if (row.status === 'active') await alertSide(client, row, row.ply % 2 === 0 ? 'sente' : 'gote', 'turn', names, now);
}

export async function POST(request: Request): Promise<Response> {
  if (!enabled()) return fail('not-found', 404);
  const origin = request.headers.get('origin');
  if (origin && !ALLOWED_ORIGIN.test(origin)) return fail('origin', 403);
  const client = db();
  if (!client) return fail('not-configured', 503);
  let body: Body;
  try { body = await request.json(); } catch { return fail('bad-json'); }
  const [user, off] = await Promise.all([userOf(client, request), paused(client)]);
  if (off) return fail('paused', 503);
  const now = Date.now();
  const guest = isSeatToken(body.seat) ? hash(body.seat) : null;
  const seat: Seat = { user, guest };
  const action = body.action;

  if (action === 'bug') return bug(client, request, body, seat, now);

  if (action === 'create') {
    if (!user) return fail('sign-in', 401);
    const input = validInvite(body);
    if (!input) return fail('bad-invite');
    const nick = await nicknames(client, [user]);
    if (!nick.get(user)) return fail('nickname', 409);
    if ((await slotsUsed(client, user, now)) >= MAX_SLOTS) return fail('full', 429);
    const made = await insertWithCode(client, newInvite({ code: '', by: user, ...input, rest: body.rest === true }, now));
    return made ? json({ code: made.code, id: made.id }) : fail('save', 500);
  }

  if (action === 'mine') {
    if (!user) return fail('sign-in', 401);
    const { data } = await client.from('friend_games').select('*')
      .or(`sente_user.eq.${user},gote_user.eq.${user},and(created_by.eq.${user},status.eq.open)`)
      .order('updated_at', { ascending: false }).limit(60);
    const rows = (data ?? []) as FriendRow[];
    const nick = await nicknames(client, rows.flatMap((r) => [...unnamed(r), r.created_by]));
    const list = [];
    for (const r0 of rows) {
      const names = namesOf(r0, nick);
      const r = r0.status === 'active' ? await settled(client, r0, names, now) : r0;
      const you = sideOf(r, seat);
      list.push({
        id: r.id, code: r.code, status: r.status, speed: r.speed, days: r.corr_days, clock: r.clock_limit ? { limit: r.clock_limit, byo: r.clock_byo } : null,
        you, names, ply: r.ply, winner: r.winner, endReason: r.end_reason, expiresAt: r.expires_at, updatedAt: r.updated_at, endedAt: r.ended_at,
        sfen: r.status === 'active' ? sfenAfter(r.start_sfen, r.moves) : null, last: r.status === 'active' ? r.moves.at(-1) ?? null : null,
        yourTurn: r.status === 'active' && !!you && (r.ply % 2 === 0 ? 'sente' : 'gote') === you,
        inviter: nick.get(r.created_by ?? '') ?? '', kif: r.kif,
        waits: !you ? null : r.status === 'active'
          ? (r.signal?.end === other(you) ? 'end' : r.takeback_by === other(you) ? 'takeback' : null)
          : (r.status === 'finished' || r.status === 'aborted') && !r.rematch_id && r.rematch_by === other(you) ? 'rematch' : null,
      });
    }
    return json({ games: list, now });
  }

  if (action === 'invite' || action === 'join' || action === 'cancel') {
    if (!isCode(body.code)) return fail('bad-code');
    const row = await load(client, 'code', body.code);
    if (!row) return fail('no-invite', 404);
    const state = inviteState(row, seat, now);
    if (action === 'invite') {
      const nick = await nicknames(client, [row.created_by]);
      return json({
        state, id: state === 'player' || state === 'mine' ? row.id : undefined, inviter: nick.get(row.created_by ?? '') ?? '',
        speed: row.speed, days: row.corr_days, clock: row.clock_limit ? { limit: row.clock_limit, byo: row.clock_byo } : null,
        color: row.inviter_color, expiresAt: row.expires_at,
      });
    }
    if (action === 'cancel') {
      if (state !== 'mine') return fail('not-yours', 403);
      const done = await save(client, row, { status: 'cancelled' });
      return done ? json({ ok: true }) : fail('stale', 409);
    }
    if (state === 'player') return json({ id: row.id });
    if (state !== 'open') return fail(state, 409);
    let token: string | undefined;
    let guestName: string | undefined;
    const joiner: Seat = {};
    if (user) {
      if (row.created_by && (await blocked(client, row.created_by, user))) return fail('taken', 409);
      if ((await slotsUsed(client, user, now)) >= MAX_SLOTS) return fail('full', 409);
      joiner.user = user;
    } else {
      const name = tidyName(body.name);
      if (name) {
        const problem = nameProblem(name);
        if (problem) return fail(`name-${problem}`, 422);
        const list = await blockedWords(client);
        if (list && blockedName(name, list)) return fail('name-blocked', 422);
        if (list) guestName = name;
      }
      token = randomBytes(32).toString('base64url');
      joiner.guest = hash(token);
    }
    const nick = await nicknames(client, [row.created_by, user]);
    const joined = await save(client, row, joinPatch(row, joiner, now, () => randomBytes(1)[0] < 128, body.rest === true,
      { inviter: nick.get(row.created_by ?? ''), joiner: user ? nick.get(user) : guestName }));
    if (!joined) return fail('taken', 409);
    if (joined.sente_user && joined.sente_user === joined.created_by) await alertTurn(client, joined, namesOf(joined, nick), now);
    return json({ id: joined.id, seat: token });
  }

  if (!isId(body.id)) return fail('bad-id');
  const row0 = await load(client, 'id', body.id);
  if (!row0) return fail('no-game', 404);
  const side = sideOf(row0, seat);
  if (!side) return fail('not-player', 403);
  const nick = await nicknames(client, unnamed(row0));
  const names = namesOf(row0, nick);
  const oppUser = side === 'sente' ? row0.gote_user : row0.sente_user;
  const cut = async () => !!user && !!oppUser && (await blocked(client, oppUser, user));
  const row = row0.status === 'active' ? await settled(client, row0, names, now) : row0;
  const reply = (r: FriendRow) => json({ game: gameView(r, side, names, Date.now()) });
  const tell = (kind: AlertKind) => (next: FriendRow) => alertSide(client, next, other(side), kind, names, now);
  const ended = (next: FriendRow) => (next.status === 'active' ? Promise.resolve() : tell('end')(next));
  const quiet = !!row.signal?.ask && now - Date.parse(row.signal.ask) < ASK_ALERT_GAP_MS;
  const asking = (patch: Patch | null) => apply(patch && !quiet ? { ...patch, signal: { ...(patch.signal ?? row.signal), ask: new Date(now).toISOString() } } : patch, quiet ? undefined : tell('ask'));
  const apply = async (patch: Patch | null, after?: (next: FriendRow) => Promise<void>) => {
    if (!patch) return fail('not-now', 409);
    const next = await save(client, row, patch);
    if (next && after) await after(next);
    return next ? reply(next) : json({ error: 'stale', game: gameView((await load(client, 'id', row.id)) ?? row, side, names, Date.now()) }, 409);
  };

  switch (action) {
    case 'state':
      return reply(row);
    case 'move': {
      if (typeof body.usi !== 'string' || body.usi.length > 8 || !Number.isInteger(body.ply)) return fail('bad-move');
      const patch = movePatch(row, side, body.usi, body.ply as number, now, names);
      if (typeof patch === 'string') return json({ error: patch, game: gameView(row, side, names, now) }, 409);
      const live = watched(row, now);
      return apply(patch, (next) => (next.status !== 'active' ? tell('end')(next) : live ? Promise.resolve() : alertTurn(client, next, names, now)));
    }
    case 'claim': {
      if (!user) return fail('sign-in', 401);
      const patch = claimPatch(row, user, guest, (await nicknames(client, [user])).get(user));
      if (!patch) return fail('not-now', 409);
      if (oppUser && (await blocked(client, oppUser, user))) return fail('not-now', 409);
      const next = await save(client, row, patch);
      if (!next) return fail('stale', 409);
      return json({ game: gameView(next, side, namesOf(next, await nicknames(client, unnamed(next))), Date.now()) });
    }
    case 'rest': {
      if (typeof body.on !== 'boolean') return fail('bad-rest');
      if (row.status !== 'active' || rests(row, side) === body.on) return reply(row);
      return apply(restPatch(row, side, body.on));
    }
    case 'resign':
      return apply(resignPatch(row, side, now, names), ended);
    case 'impasse':
      return apply(impassePatch(row, side, now, names), ended);
    case 'takeback':
      if (body.cancel === true) return apply(takebackCancel(row, side));
      if (body.answer === undefined) return asking(takebackAsk(row, side));
      return apply(takebackAnswer(row, side, body.answer === true, now), (next) => (next.ply % 2 === 0 ? 'sente' : 'gote') === side ? Promise.resolve() : alertTurn(client, next, names, now));
    case 'end':
      if (body.cancel === true) return apply(endCancel(row, side));
      if (body.answer === undefined) return asking(endAsk(row, side));
      return apply(endAnswer(row, side, body.answer === true, now, names), ended);
    case 'signal':
      if (await cut()) return fail('not-now', 409);
      return apply(signalPatch(row, side, body.m as Signal, now));
    case 'rematch': {
      if (row.rematch_id) return json({ id: row.rematch_id });
      if (await cut()) return fail('not-now', 409);
      for (const who of [user, row.rematch_by && row.rematch_by !== side ? oppUser : null]) {
        if (who && (await slotsUsed(client, who, now)) >= MAX_SLOTS) return fail('full', 409);
      }
      if (!row.rematch_by || row.rematch_by === side) return asking(rematchAsk(row, side));
      const values = rematchRow(row, side, '', now);
      if (!values) return fail('not-now', 409);
      const made = await insertWithCode(client, values);
      if (!made) return fail('save', 500);
      const linked = await save(client, row, { rematch_id: made.id });
      if (!linked) {
        await client.from('friend_games').delete().eq('id', made.id);
        const fresh = await load(client, 'id', row.id);
        return fresh?.rematch_id ? json({ id: fresh.rematch_id }) : fail('stale', 409);
      }
      await alertTurn(client, made, namesOf(made, nick), now);
      return json({ id: made.id });
    }
    case 'report': {
      const reason = ['name', 'cheat', 'stall', 'other'].includes(body.reason as string) ? (body.reason as string) : 'other';
      const mine = client.from('friend_reports').select('id').eq('game_id', row.id);
      const { data: before } = await (user ? mine.eq('reporter_user', user) : mine.eq('reporter_guest', true)).limit(1);
      if (before?.length) return json({ ok: true });
      await client.from('friend_reports').insert({ game_id: row.id, reporter_user: user, reporter_guest: !user, reported_user: oppUser, reason });
      await sendReport(row, reason, names, side);
      return json({ ok: true });
    }
    case 'block': {
      if (!user) return fail('sign-in', 401);
      if (oppUser) await client.from('friend_blocks').upsert({ user_id: user, blocked: oppUser }, { onConflict: 'user_id,blocked', ignoreDuplicates: true });
      const end = row.status === 'active' ? resignPatch(row, side, now, names) : null;
      let over = end ? await save(client, row, end) : null;
      if (end && !over) {
        const fresh = await load(client, 'id', row.id);
        const again = fresh ? resignPatch(fresh, side, now, names) : null;
        if (fresh && again) over = await save(client, fresh, again);
      }
      if (over) await ended(over);
      return json({ ok: true });
    }
    default:
      return fail('bad-action');
  }
}
