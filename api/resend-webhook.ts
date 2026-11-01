import { createClient } from '@supabase/supabase-js';

const b64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf)));

async function verify(secret: string, id: string, ts: string, body: string, header: string): Promise<boolean> {
  if (!id || !ts || !header || Math.abs(Date.now() / 1000 - Number(ts)) > 5 * 60) return false;
  const raw = Uint8Array.from(atob(secret.replace(/^whsec_/, '')), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const want = b64(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${id}.${ts}.${body}`)));
  return header.split(' ').some((part) => part.split(',')[1] === want);
}

export async function POST(request: Request): Promise<Response> {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  const url = process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret || !url || !serviceKey) return new Response('not configured', { status: 503 });
  const body = await request.text();
  const h = request.headers;
  if (!(await verify(secret, h.get('svix-id') ?? '', h.get('svix-timestamp') ?? '', body, h.get('svix-signature') ?? ''))) {
    return new Response('bad signature', { status: 401 });
  }
  let event: { type?: string; data?: { email_id?: string } };
  try { event = JSON.parse(body); } catch { return new Response('bad body', { status: 400 }); }
  const reason = event.type === 'email.bounced' ? 'bounce' : event.type === 'email.complained' ? 'complaint' : null;
  const emailId = event.data?.email_id;
  if (!reason || !emailId) return new Response('ignored');
  const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data } = await db.from('email_log').select('user_id').eq('resend_id', emailId).maybeSingle();
  if (data) await db.from('notification_prefs').update({ paused_reason: reason, updated_at: new Date().toISOString() }).eq('user_id', data.user_id);
  return new Response('ok');
}
