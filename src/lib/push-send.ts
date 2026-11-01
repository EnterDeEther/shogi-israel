import webpush from 'web-push';
import type { SupabaseClient } from '@supabase/supabase-js';
import { afterPush, buildPush, duePush, isPublished, type Notice, type PushContext, type PushMessage, type PushRow } from './push.js';
import { asGender } from './gender.js';

export const pushConfigured = (): boolean => Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

function setup() {
  webpush.setVapidDetails('mailto:contact@shogi.co.il', process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
}

export async function sendOne(row: Pick<PushRow, 'endpoint'> & { p256dh: string; auth: string }, msg: PushMessage): Promise<'ok' | 'gone' | 'error'> {
  setup();
  try {
    await webpush.sendNotification({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } }, JSON.stringify(msg), { TTL: 12 * 3600, urgency: 'normal' });
    return 'ok';
  } catch (e) {
    const code = (e as { statusCode?: number }).statusCode;
    if (code === 404 || code === 410) return 'gone';
    console.error('push: send failed', code, (e as Error).message);
    return 'error';
  }
}

type Row = PushRow & { p256dh: string; auth: string };

export async function runPush(db: SupabaseClient, now: Date, weekCount: number, dry: boolean) {
  const { data: rows, error } = await db.from('push_subscriptions').select('*').or('push_week.eq.true,push_course.eq.true,push_news.eq.true').limit(5000);
  if (error) return { error: error.message };
  const { data: noticeRows } = await db.from('notices').select('*')
    .lte('starts_at', now.toISOString()).or(`ends_at.is.null,ends_at.gt.${now.toISOString()}`).order('starts_at', { ascending: false }).limit(20);
  const notices = (noticeRows ?? []).filter(isPublished).slice(0, 10);

  const ids = [...new Set((rows ?? []).map((r) => r.user_id).filter(Boolean))] as string[];
  const progress = new Map<string, unknown>();
  const seen = new Map<string, string | null>();
  const gender = new Map<string, string>();
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const [p, s] = await Promise.all([
      db.from('progress').select('user_id, data, updated_at').in('user_id', chunk),
      db.from('notification_prefs').select('user_id, last_seen_at').in('user_id', chunk),
    ]);
    for (const r of p.data ?? []) { progress.set(r.user_id, r.data); seen.set(r.user_id, r.updated_at); }
    for (const r of s.data ?? []) {
      const a = seen.get(r.user_id);
      if (r.last_seen_at && (!a || r.last_seen_at > a)) seen.set(r.user_id, r.last_seen_at);
    }
  }

  let sent = 0, gone = 0, failed = 0;
  const plan: { phone: string; kind: string }[] = [];
  for (const row of (rows ?? []) as Row[]) {
    const ctx: PushContext = {
      now, weekCount, notices: (notices ?? []) as Notice[],
      progressData: row.user_id ? progress.get(row.user_id) : undefined,
      lastSeen: row.user_id ? seen.get(row.user_id) : undefined,
    };
    const due = duePush(row, ctx);
    if (!due) continue;
    plan.push({ phone: row.endpoint.slice(-8), kind: due.kind });
    if (dry) continue;
    if (row.user_id && !gender.has(row.user_id)) {
      const { data: u } = await db.auth.admin.getUserById(row.user_id);
      gender.set(row.user_id, asGender(u?.user?.user_metadata?.gender ?? row.gender));
    }
    const g = asGender(row.user_id ? gender.get(row.user_id) : row.gender);
    const res = await sendOne(row, buildPush(due, ctx, g));
    if (res === 'ok') { sent++; await db.from('push_subscriptions').update(afterPush(row, due, ctx)).eq('endpoint', row.endpoint); }
    else if (res === 'gone') { gone++; await db.from('push_subscriptions').delete().eq('endpoint', row.endpoint); }
    else failed++;
  }
  return dry ? { phones: rows?.length ?? 0, due: plan.length, plan } : { phones: rows?.length ?? 0, due: plan.length, sent, gone, failed };
}
