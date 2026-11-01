import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { adLabel, buildReport, REPORT_FROM, reportEmail, reportsDue, signupEmail, totals, type Email, type PlayerInput, type Totals } from '../src/lib/admin-report.js';
import { israelDay } from '../src/lib/notify.js';

const DAY = 24 * 60 * 60 * 1000;

function env() {
  const url = process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  const to = process.env.ADMIN_REPORT_EMAIL;
  if (!url || !serviceKey || !resendKey || !to) return null;
  return { db: createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } }), resendKey, to };
}

async function send(resendKey: string, to: string, email: Email, tag: string): Promise<boolean> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: REPORT_FROM, to: [to], subject: email.subject, html: email.html, text: email.text, tags: [{ name: 'kind', value: tag }] }),
  });
  if (!res.ok) console.error('admin-report: resend failed', res.status, await res.text());
  return res.ok;
}

async function authUsers(db: SupabaseClient) {
  const users: { id: string; created_at: string; confirmed: boolean; ad: string | null }[] = [];
  for (let page = 1; page < 50; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    for (const u of data.users) users.push({ id: u.id, created_at: u.created_at, confirmed: !!u.email_confirmed_at, ad: adLabel(u.user_metadata?.ad_source) });
    if (data.users.length < 1000) break;
  }
  return users;
}

async function players(db: SupabaseClient): Promise<PlayerInput[]> {
  const users = await authUsers(db);
  const [profiles, progress, prefs, games] = await Promise.all([
    db.from('profiles').select('id, nickname').limit(10000),
    db.from('progress').select('user_id, data, updated_at').limit(10000),
    db.from('notification_prefs').select('user_id, email_week, last_seen_at').limit(10000),
    db.from('games').select('user_id, result, played_at').neq('result', 'abort').limit(50000),
  ]);
  const nick = new Map((profiles.data ?? []).map((r) => [r.id, r.nickname as string]));
  const prog = new Map((progress.data ?? []).map((r) => [r.user_id, r]));
  const pref = new Map((prefs.data ?? []).map((r) => [r.user_id, r]));
  const g = new Map<string, { games: number; wins: number; last: string | null }>();
  for (const r of games.data ?? []) {
    const x = g.get(r.user_id) ?? { games: 0, wins: 0, last: null };
    x.games++;
    if (r.result === 'win') x.wins++;
    if (!x.last || r.played_at > x.last) x.last = r.played_at;
    g.set(r.user_id, x);
  }
  return users.map((u) => ({
    id: u.id, nickname: nick.get(u.id) ?? null, created_at: u.created_at, confirmed: u.confirmed,
    progress: prog.get(u.id)?.data ?? null, progress_at: prog.get(u.id)?.updated_at ?? null,
    games: g.get(u.id)?.games ?? 0, wins: g.get(u.id)?.wins ?? 0, last_game_at: g.get(u.id)?.last ?? null,
    last_seen_at: pref.get(u.id)?.last_seen_at ?? null, email_week: !!pref.get(u.id)?.email_week, ad: u.ad,
  }));
}

async function snapshotsAsOf(db: SupabaseClient, day: string): Promise<Map<string, Totals> | null> {
  const { data: last } = await db.from('admin_snapshots').select('day').lte('day', day).order('day', { ascending: false }).limit(1);
  if (!last?.length) return null;
  const { data } = await db.from('admin_snapshots').select('user_id, xp, levels_done, rules_done, tsume_solved, games, wins').eq('day', last[0].day).limit(10000);
  return new Map((data ?? []).map(({ user_id, ...t }) => [user_id, t as Totals]));
}

export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return new Response('unauthorized', { status: 401 });
  const e = env();
  if (!e) return Response.json({ error: 'not-configured' }, { status: 503 });
  const params = new URL(request.url).searchParams;
  const dry = params.get('dry') === '1';
  const now = new Date();
  const today = israelDay(now).ymd;
  const kinds = params.get('kind') === 'weekly' ? (['weekly'] as const) : reportsDue(now);

  const list = await players(e.db);
  const reports = [];
  for (const kind of kinds) {
    const from = israelDay(new Date(now.getTime() - (kind === 'daily' ? 1 : 7) * DAY)).ymd;
    reports.push(buildReport(kind, list, await snapshotsAsOf(e.db, from), now));
  }
  if (dry) return Response.json(reports);

  const sent: string[] = [];
  for (const r of reports) if (await send(e.resendKey, e.to, reportEmail(r), `admin-${r.kind}`)) sent.push(r.kind);
  const rows = list.map((p) => ({ day: today, user_id: p.id, ...totals(p) }));
  const { error } = rows.length ? await e.db.from('admin_snapshots').upsert(rows) : { error: null };
  if (error) console.error('admin-report: snapshot failed', error.message);
  return Response.json({ sent, players: list.length, snapshot: !error });
}

export async function POST(): Promise<Response> {
  const e = env();
  if (!e) return Response.json({ error: 'not-configured' }, { status: 503 });
  const since = new Date(Date.now() - 2 * DAY).toISOString();
  const { data: fresh } = await e.db.from('profiles').select('id, nickname, created_at').gt('created_at', since).limit(100);
  if (!fresh?.length) return Response.json({ sent: 0 });
  const { data: done } = await e.db.from('admin_alerts').select('user_id').in('user_id', fresh.map((p) => p.id));
  const seen = new Set((done ?? []).map((r) => r.user_id));
  const todo = fresh.filter((p) => !seen.has(p.id));
  if (!todo.length) return Response.json({ sent: 0 });
  const { data: claimed } = await e.db.from('admin_alerts').upsert(todo.map((p) => ({ user_id: p.id })), { onConflict: 'user_id', ignoreDuplicates: true }).select('user_id');
  const mine = new Set((claimed ?? []).map((r) => r.user_id));
  const batch = todo.filter((p) => mine.has(p.id));
  if (!batch.length) return Response.json({ sent: 0 });
  const [{ count }, { data: prefs }] = await Promise.all([
    e.db.from('profiles').select('id', { count: 'exact', head: true }),
    e.db.from('notification_prefs').select('user_id, email_week').in('user_id', batch.map((p) => p.id)),
  ]);
  const week = new Set((prefs ?? []).filter((r) => r.email_week).map((r) => r.user_id));
  const ads = new Map<string, string | null>();
  for (const p of batch) ads.set(p.id, adLabel((await e.db.auth.admin.getUserById(p.id)).data.user?.user_metadata?.ad_source));
  const ok = await send(e.resendKey, e.to, signupEmail(batch.map((p) => ({ nickname: p.nickname, created_at: p.created_at, total: count ?? 0, email_week: week.has(p.id), ad: ads.get(p.id) }))), 'admin-signup');
  if (!ok) await e.db.from('admin_alerts').delete().in('user_id', batch.map((p) => p.id));
  return Response.json({ sent: ok ? batch.length : 0 });
}
