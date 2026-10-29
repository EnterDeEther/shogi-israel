// Vercel Function: /api/push, the phone's push-notification settings (src/lib/push-client.ts calls it from the app).
// GET: the site's public push key, or 503 while the keys aren't set (the settings then stay hidden).
// POST { subscription, kinds, gender, token? }: saves which kinds this phone wants; all off deletes the phone.
//   With the account's access token the phone is tied to the account (for the course reminder). A phone that
//   turns notifications on for the first time gets one push at once, to show that they work.
// DELETE { endpoint }: removes the phone.
// Needs VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, SUPABASE_SERVICE_ROLE_KEY and the Supabase URL.
import { createClient } from '@supabase/supabase-js';
import { PUSH_KINDS, pushEndpointOk, WELCOME, type PushKinds } from '../src/lib/push.js';
import { pushConfigured, sendOne } from '../src/lib/push-send.js';
import { resolve, asGender } from '../src/lib/gender.js';

function db() {
  const url = process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && serviceKey ? createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
}

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const key64 = (v: unknown, max: number): v is string => typeof v === 'string' && v.length > 0 && v.length <= max && /^[A-Za-z0-9_\-=+/]+$/.test(v);

// only our own pages may change a phone's settings
const sameSite = (request: Request) => {
  const origin = request.headers.get('origin');
  return !origin || origin === new URL(request.url).origin;
};

export async function GET(): Promise<Response> {
  if (!pushConfigured()) return json({ error: 'not-configured' }, 503);
  return Response.json({ key: process.env.VAPID_PUBLIC_KEY }, { headers: { 'Cache-Control': 'public, max-age=3600' } });
}

export async function POST(request: Request): Promise<Response> {
  const client = db();
  if (!client || !pushConfigured()) return json({ error: 'not-configured' }, 503);
  if (!sameSite(request)) return json({ error: 'origin' }, 403);
  let body: { subscription?: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } }; kinds?: Partial<PushKinds>; gender?: unknown; token?: unknown };
  try { body = await request.json(); } catch { return json({ error: 'bad-json' }, 400); }
  const sub = body.subscription;
  const endpoint = sub?.endpoint;
  if (!pushEndpointOk(endpoint) || !key64(sub?.keys?.p256dh, 200) || !key64(sub?.keys?.auth, 100)) return json({ error: 'bad-subscription' }, 400);
  const kinds = Object.fromEntries(PUSH_KINDS.map((k) => [k, body.kinds?.[k] === true])) as PushKinds;

  if (!PUSH_KINDS.some((k) => kinds[k])) {
    await client.from('push_subscriptions').delete().eq('endpoint', endpoint);
    return json({ ok: true, on: false });
  }

  let userId: string | null = null;
  if (typeof body.token === 'string' && body.token.length < 4000) {
    const { data } = await client.auth.getUser(body.token);
    userId = data.user?.id ?? null;
  }
  // the course reminder needs the account's progress
  if (!userId) kinds.course = false;
  const gender = asGender(body.gender);

  const { data: before } = await client.from('push_subscriptions').select('endpoint').eq('endpoint', endpoint).maybeSingle();
  const row = {
    endpoint, p256dh: sub!.keys!.p256dh as string, auth: sub!.keys!.auth as string, user_id: userId, gender,
    push_week: kinds.week, push_course: kinds.course, push_news: kinds.news, updated_at: new Date().toISOString(),
  };
  const { error } = await client.from('push_subscriptions').upsert(row, { onConflict: 'endpoint' });
  if (error) { console.error('push: save failed', error.message); return json({ error: 'save' }, 500); }

  if (!before) {
    const res = await sendOne(row, { ...WELCOME, body: resolve(WELCOME.body, gender) });
    if (res === 'gone') { await client.from('push_subscriptions').delete().eq('endpoint', endpoint); return json({ error: 'gone' }, 410); }
  }
  return json({ ok: true, on: true, kinds });
}

export async function DELETE(request: Request): Promise<Response> {
  const client = db();
  if (!client) return json({ error: 'not-configured' }, 503);
  if (!sameSite(request)) return json({ error: 'origin' }, 403);
  let endpoint: unknown;
  try { endpoint = (await request.json()).endpoint; } catch { return json({ error: 'bad-json' }, 400); }
  if (!pushEndpointOk(endpoint)) return json({ error: 'bad-subscription' }, 400);
  await client.from('push_subscriptions').delete().eq('endpoint', endpoint);
  return json({ ok: true });
}
