import { createClient } from '@supabase/supabase-js';
import { buildEmail, dueEmail, FROM, REPLY_TO, unsubscribeUrl, type EmailKind, type PrefsRow } from '../src/lib/notify.js';
import { asGender } from '../src/lib/gender.js';
import { TSUME_COUNTS } from '../src/lib/level-counts.js';
import { WEEK_LENGTH } from '../src/tsume/week.js';
import { pushConfigured, runPush } from '../src/lib/push-send.js';

const DAILY_MAX = Number(process.env.NOTIFY_DAILY_MAX) || 80;

export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return new Response('unauthorized', { status: 401 });
  const url = process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  if (!url || !serviceKey) return Response.json({ error: 'not-configured' }, { status: 503 });

  const params = new URL(request.url).searchParams;
  const dry = params.get('dry') === '1';
  const only = params.get('user');
  const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const now = new Date();
  const weekCount = TSUME_COUNTS[WEEK_LENGTH];
  const push = !only && pushConfigured() ? await runPush(db, now, weekCount, dry).catch((e: Error) => ({ error: e.message })) : null;
  if (!resendKey) return Response.json({ error: 'not-configured', push }, { status: 503 });

  let q = db.from('notification_prefs').select('user_id, email_week, email_return, paused_reason, last_seen_at, return_sent, last_email_at')
    .or('email_week.eq.true,email_return.eq.true').is('paused_reason', null).limit(5000);
  if (only) q = q.eq('user_id', only);
  const { data: rows, error } = await q;
  if (error) return Response.json({ error: 'prefs', detail: error.message }, { status: 500 });

  const ids = (rows ?? []).map((r) => r.user_id);
  const progress = new Map<string, { data: unknown; updated_at: string }>();
  const nicknames = new Map<string, string>();
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const [p, n] = await Promise.all([
      db.from('progress').select('user_id, data, updated_at').in('user_id', chunk),
      db.from('profiles').select('id, nickname').in('id', chunk),
    ]);
    for (const r of p.data ?? []) progress.set(r.user_id, r);
    for (const r of n.data ?? []) nicknames.set(r.id, r.nickname);
  }

  const plan: { user: string; kind: EmailKind }[] = [];
  for (const row of (rows ?? []) as PrefsRow[]) {
    const prog = progress.get(row.user_id);
    const kind = only
      ? (row.email_week ? 'week' : 'return')
      : dueEmail(row, prog?.data, now, weekCount, prog?.updated_at);
    if (kind) plan.push({ user: row.user_id, kind });
  }
  if (dry) return Response.json({ now: now.toISOString(), opted_in: rows?.length ?? 0, due: plan.length, plan: plan.map((p) => ({ ...p, user: p.user.slice(0, 8) })), push });

  let sent = 0;
  const failed: string[] = [];
  for (const { user, kind } of plan.slice(0, DAILY_MAX)) {
    const row = (rows as PrefsRow[]).find((r) => r.user_id === user)!;
    const { data: u } = await db.auth.admin.getUserById(user);
    const to = u?.user?.email;
    if (!to || !u.user?.email_confirmed_at) continue;
    const unsub = await unsubscribeUrl(secret, user, kind);
    const gender = asGender(u.user.user_metadata?.gender);
    const email = buildEmail({
      kind, gender, nickname: nicknames.get(user) ?? (gender === 'f' ? 'שחקנית' : 'שחקן'), progressData: progress.get(user)?.data, weekCount, now,
      returnIndex: row.return_sent, unsubscribeUrl: unsub,
    });
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM, to: [to], reply_to: REPLY_TO, subject: email.subject, html: email.html, text: email.text,
        headers: { 'List-Unsubscribe': `<${unsub}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
        tags: [{ name: 'kind', value: kind }],
      }),
    });
    if (!res.ok) {
      console.error('notify: resend failed', res.status, await res.text());
      failed.push(user.slice(0, 8));
      if (res.status === 429) break;
      continue;
    }
    const { id } = (await res.json()) as { id?: string };
    sent++;
    await db.from('email_log').insert({ user_id: user, kind, resend_id: id ?? null });
    await db.from('notification_prefs').update({
      last_email_at: now.toISOString(),
      ...(kind === 'return' ? { return_sent: row.return_sent + 1 } : {}),
    }).eq('user_id', user);
  }
  return Response.json({ due: plan.length, sent, failed, left: Math.max(0, plan.length - DAILY_MAX), push });
}
