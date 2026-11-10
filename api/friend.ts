import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createHash, randomBytes } from 'node:crypto';
import {
  type FriendRow, GUEST_NAME, gameView, impassePatch, inviteState, joinPatch, MAX_OPEN_INVITES, movePatch, type Names, newCode, newInvite,
  type Patch, rematchAsk, rematchRow, resignPatch, type Seat, settle, sideOf, type Signal, signalPatch, takebackAnswer, takebackAsk, validInvite,
} from '../src/friend/core.js';

const ALLOWED_ORIGIN = /^https:\/\/((www\.)?shogi\.co\.il|shogi-israel-[a-z0-9-]+-enterdeether\.vercel\.app)$/;
const REPORT_TO = 'contact@shogi.co.il';
const FROM = 'שוגי ישראל <noreply@shogi.co.il>';

const enabled = () => process.env.VERCEL_ENV !== 'production' || process.env.FRIEND_PLAY === '1';
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const fail = (error: string, status = 400) => json({ error }, status);

function db(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
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

async function nicknames(client: SupabaseClient, ids: (string | null)[]): Promise<Map<string, string>> {
  const want = [...new Set(ids.filter((x): x is string => !!x))];
  if (!want.length) return new Map();
  const { data } = await client.from('profiles').select('id, nickname').in('id', want);
  return new Map((data ?? []).map((p: { id: string; nickname: string }) => [p.id, p.nickname]));
}

function namesOf(row: FriendRow, nick: Map<string, string>): Names {
  const name = (user: string | null) => (user ? nick.get(user) ?? 'שחקן' : GUEST_NAME);
  return { sente: name(row.sente_user), gote: name(row.gote_user) };
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

type Body = Record<string, unknown>;

export async function POST(request: Request): Promise<Response> {
  if (!enabled()) return fail('not-found', 404);
  const origin = request.headers.get('origin');
  if (origin && !ALLOWED_ORIGIN.test(origin)) return fail('origin', 403);
  const client = db();
  if (!client) return fail('not-configured', 503);
  let body: Body;
  try { body = await request.json(); } catch { return fail('bad-json'); }
  const now = Date.now();
  const user = await userOf(client, request);
  const guest = isSeatToken(body.seat) ? hash(body.seat) : null;
  const seat: Seat = { user, guest };
  const action = body.action;

  if (action === 'create') {
    if (!user) return fail('sign-in', 401);
    const input = validInvite(body);
    if (!input) return fail('bad-invite');
    const nick = await nicknames(client, [user]);
    if (!nick.get(user)) return fail('nickname', 409);
    const { count } = await client.from('friend_games').select('id', { count: 'exact', head: true })
      .eq('created_by', user).eq('status', 'open').gt('expires_at', new Date(now).toISOString());
    if ((count ?? 0) >= MAX_OPEN_INVITES) return fail('too-many', 429);
    const made = await insertWithCode(client, newInvite({ code: '', by: user, ...input }, now));
    return made ? json({ code: made.code, id: made.id }) : fail('save', 500);
  }

  if (action === 'mine') {
    if (!user) return fail('sign-in', 401);
    const { data } = await client.from('friend_games').select('*')
      .or(`sente_user.eq.${user},gote_user.eq.${user},and(created_by.eq.${user},status.eq.open)`)
      .order('updated_at', { ascending: false }).limit(60);
    const rows = (data ?? []) as FriendRow[];
    const nick = await nicknames(client, rows.flatMap((r) => [r.sente_user, r.gote_user, r.created_by]));
    const list = [];
    for (const r0 of rows) {
      const names = namesOf(r0, nick);
      const r = r0.status === 'active' ? await settled(client, r0, names, now) : r0;
      const you = sideOf(r, seat);
      list.push({
        id: r.id, code: r.code, status: r.status, speed: r.speed, days: r.corr_days, clock: r.clock_limit ? { limit: r.clock_limit, byo: r.clock_byo } : null,
        you, names, ply: r.ply, winner: r.winner, endReason: r.end_reason, expiresAt: r.expires_at, updatedAt: r.updated_at,
        yourTurn: r.status === 'active' && !!you && (r.ply % 2 === 0 ? 'sente' : 'gote') === you,
        inviter: nick.get(r.created_by) ?? '', kif: r.kif,
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
        state, id: state === 'player' || state === 'mine' ? row.id : undefined, inviter: nick.get(row.created_by) ?? '',
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
    const joiner: Seat = {};
    if (user) {
      if (await blocked(client, row.created_by, user)) return fail('taken', 409);
      joiner.user = user;
    } else {
      token = randomBytes(32).toString('base64url');
      joiner.guest = hash(token);
    }
    const joined = await save(client, row, joinPatch(row, joiner, now, () => randomBytes(1)[0] < 128));
    return joined ? json({ id: joined.id, seat: token }) : fail('taken', 409);
  }

  if (!isId(body.id)) return fail('bad-id');
  const row0 = await load(client, 'id', body.id);
  if (!row0) return fail('no-game', 404);
  const side = sideOf(row0, seat);
  if (!side) return fail('not-player', 403);
  const nick = await nicknames(client, [row0.sente_user, row0.gote_user]);
  const names = namesOf(row0, nick);
  const row = row0.status === 'active' ? await settled(client, row0, names, now) : row0;
  const reply = (r: FriendRow) => json({ game: gameView(r, side, names, Date.now()) });
  const apply = async (patch: Patch | null, error = 'not-now') => {
    if (!patch) return fail(error, 409);
    const next = await save(client, row, patch);
    return next ? reply(next) : json({ error: 'stale', game: gameView((await load(client, 'id', row.id)) ?? row, side, names, Date.now()) }, 409);
  };

  switch (action) {
    case 'state':
      return reply(row);
    case 'move': {
      if (typeof body.usi !== 'string' || body.usi.length > 8 || !Number.isInteger(body.ply)) return fail('bad-move');
      const patch = movePatch(row, side, body.usi, body.ply as number, now, names);
      if (typeof patch === 'string') return json({ error: patch, game: gameView(row, side, names, now) }, 409);
      return apply(patch);
    }
    case 'resign':
      return apply(resignPatch(row, side, now, names));
    case 'impasse':
      return apply(impassePatch(row, side, now, names));
    case 'takeback':
      return apply(body.answer === undefined ? takebackAsk(row, side) : takebackAnswer(row, side, body.answer === true, now));
    case 'signal':
      return apply(signalPatch(row, side, body.m as Signal, now));
    case 'rematch': {
      if (row.rematch_id) return json({ id: row.rematch_id });
      if (!row.rematch_by || row.rematch_by === side) return apply(rematchAsk(row, side));
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
      return json({ id: made.id });
    }
    case 'report': {
      const reason = ['name', 'cheat', 'stall', 'other'].includes(body.reason as string) ? (body.reason as string) : 'other';
      const opp = side === 'sente' ? row.gote_user : row.sente_user;
      await client.from('friend_reports').insert({ game_id: row.id, reporter_user: user, reporter_guest: !user, reported_user: opp, reason });
      await sendReport(row, reason, names, side);
      return json({ ok: true });
    }
    case 'block': {
      if (!user) return fail('sign-in', 401);
      const opp = side === 'sente' ? row.gote_user : row.sente_user;
      if (opp) await client.from('friend_blocks').upsert({ user_id: user, blocked: opp }, { onConflict: 'user_id,blocked', ignoreDuplicates: true });
      if (row.status === 'active') await save(client, row, resignPatch(row, side, now, names) ?? {});
      return json({ ok: true });
    }
    default:
      return fail('bad-action');
  }
}
