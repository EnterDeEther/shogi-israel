// AGPL-3.0-or-later, like the rest of this site.
import type { SupabaseClient } from '@supabase/supabase-js';
import { asGender } from '../lib/gender.js';
import { FROM as MAIL_FROM, REPLY_TO, unsubscribeUrl } from '../lib/notify.js';
import { pushConfigured, sendOne } from '../lib/push-send.js';
import { type AlertKind, gameEmail, gamePush, TURN_MAIL_GAP_MS } from './alerts.js';
import { type FriendRow, GUEST_NAME, inRest, type Names, other, remindedPatch, remindSide, rests } from './core.js';

const REMIND_MAX = 40;

export async function nicknames(client: SupabaseClient, ids: (string | null)[]): Promise<Map<string, string>> {
  const want = [...new Set(ids.filter((x): x is string => !!x))];
  if (!want.length) return new Map();
  const { data } = await client.from('profiles').select('id, nickname').in('id', want);
  return new Map((data ?? []).map((p: { id: string; nickname: string }) => [p.id, p.nickname]));
}

export function namesOf(row: FriendRow, nick: Map<string, string>): Names {
  const name = (kept: string | null | undefined, user: string | null) => kept || (user ? nick.get(user) ?? 'שחקן' : GUEST_NAME);
  return { sente: name(row.sente_name, row.sente_user), gote: name(row.gote_name, row.gote_user) };
}

export const unnamed = (row: FriendRow): (string | null)[] => [row.sente_name ? null : row.sente_user, row.gote_name ? null : row.gote_user];

async function pushTo(client: SupabaseClient, to: string, kind: AlertKind, opp: string, row: FriendRow): Promise<void> {
  if (!pushConfigured()) return;
  const { data } = await client.from('push_subscriptions').select('endpoint, p256dh, auth').eq('user_id', to).eq('push_turn', true).limit(5);
  for (const sub of (data ?? []) as { endpoint: string; p256dh: string; auth: string }[]) {
    if ((await sendOne(sub, gamePush(kind, opp, row.id, row.move_deadline ? Date.parse(row.move_deadline) : null))) === 'gone') await client.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
  }
}

async function mailTo(client: SupabaseClient, to: string, kind: AlertKind, nickname: string, opp: string, row: FriendRow, now: number): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  const secret = process.env.CRON_SECRET;
  if (!key || !secret) return;
  const { data: prefs } = await client.from('notification_prefs').select('email_turn, paused_reason').eq('user_id', to).maybeSingle();
  if (!prefs?.email_turn || prefs.paused_reason) return;
  const { data: recent } = await client.from('email_log').select('id').eq('user_id', to).eq('kind', 'turn').eq('game_id', row.id)
    .gt('sent_at', new Date(now - TURN_MAIL_GAP_MS).toISOString()).limit(1);
  if (recent?.length) return;
  const { data: u } = await client.auth.admin.getUserById(to);
  const address = u?.user?.email;
  if (!address || !u.user?.email_confirmed_at) return;
  const unsub = await unsubscribeUrl(secret, to, 'turn');
  const mail = gameEmail(kind, { nickname, opp, id: row.id, deadline: row.move_deadline ? Date.parse(row.move_deadline) : null, gender: asGender(u.user.user_metadata?.gender), unsubscribeUrl: unsub });
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: MAIL_FROM, to: [address], reply_to: REPLY_TO, subject: mail.subject, html: mail.html, text: mail.text,
      headers: { 'List-Unsubscribe': `<${unsub}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
      tags: [{ name: 'kind', value: kind }],
    }),
  });
  if (!res.ok) { console.error('friend: mail failed', kind, res.status); return; }
  const { id } = (await res.json()) as { id?: string };
  await client.from('email_log').insert({ user_id: to, kind: 'turn', game_id: row.id, resend_id: id ?? null });
}

export async function alertSide(client: SupabaseClient, row: FriendRow, side: 'sente' | 'gote', kind: AlertKind, names: Names, now: number): Promise<void> {
  const to = row[`${side}_user`];
  if (row.speed !== 'corr' || !to || (rests(row, side) && inRest(now))) return;
  const opp = names[other(side)];
  const work = Promise.allSettled([pushTo(client, to, kind, opp, row), mailTo(client, to, kind, names[side], opp, row, now)]);
  await Promise.race([work, new Promise((done) => setTimeout(done, 4000))]);
}

export async function remindSoon(client: SupabaseClient, now: number, dry = false): Promise<{ due: number; sent: number } | { paused: true }> {
  const { data: gate } = await client.from('site_switches').select('off').eq('name', 'friend_play').maybeSingle();
  if ((gate as { off?: boolean } | null)?.off === true) return { paused: true };
  const { data } = await client.from('friend_games').select('*').eq('status', 'active').eq('speed', 'corr')
    .gt('move_deadline', new Date(now).toISOString()).lt('move_deadline', new Date(now + 5 * 864e5).toISOString())
    .order('move_deadline', { ascending: true }).limit(200);
  const due = ((data ?? []) as FriendRow[]).flatMap((row) => { const side = remindSide(row, now); return side ? [{ row, side }] : []; });
  if (dry || !due.length) return { due: due.length, sent: 0 };
  const batch = due.slice(0, REMIND_MAX);
  const nick = await nicknames(client, batch.flatMap(({ row }) => unnamed(row)));
  let sent = 0;
  for (const { row, side } of batch) {
    const { data: kept } = await client.from('friend_games').update(remindedPatch(row)).eq('id', row.id).eq('updated_at', row.updated_at).select('*').maybeSingle();
    if (!kept) continue;
    await alertSide(client, kept as FriendRow, side, 'soon', namesOf(row, nick), now);
    sent++;
  }
  return { due: due.length, sent };
}
