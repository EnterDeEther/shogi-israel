// Vercel Function: /api/unsubscribe, the link at the bottom of every nudge email (src/lib/notify.ts signs it).
// GET shows a short page with a button (link checkers in mail systems open links, so a GET never changes anything).
// POST turns the email off: from that button, or straight from Gmail/Yahoo's own "Unsubscribe" (RFC 8058 one-click).
// No sign-in needed. Needs CRON_SECRET (it signs the links), SUPABASE_SERVICE_ROLE_KEY and the Supabase URL.
import { createClient } from '@supabase/supabase-js';
import { checkUnsubscribe, unsubscribeToken, type UnsubKind } from '../src/lib/notify.js';

const NAME: Record<UnsubKind, string> = { week: 'בעיית השבוע במייל', return: 'תזכורות לחזור לאתר', all: 'כל המיילים מהאתר (חוץ ממיילי החשבון)' };

function page(title: string, body: string, status = 200): Response {
  const html = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title} · שוגי ישראל</title>
<style>body{margin:0;background:#F6F0E4;color:#1E1A14;font:18px/1.6 Arial,Helvetica,sans-serif}main{max-width:520px;margin:0 auto;padding:40px 20px}h1{font-size:26px;margin:0 0 12px}button{font:inherit;font-weight:bold;background:#B8361F;color:#fff;border:0;border-radius:6px;padding:12px 20px;cursor:pointer;margin:6px 0}button.ghost{background:transparent;color:#1E1A14;border:1.5px solid #1E1A14}a{color:#B8361F}form{margin:0}@media(prefers-color-scheme:dark){body{background:#17150F;color:#EDE6D6}button.ghost{color:#EDE6D6;border-color:#EDE6D6}a{color:#E8694C}}</style>
</head><body><main><p><a href="/">将棋 שוגי ישראל</a></p><h1>${title}</h1>${body}<p style="font-size:13px;opacity:.75">הטקסטים מנוסחים בלשון זכר מטעמי נוחות אך פונים לשני המינים.</p></main></body></html>`;
  return new Response(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}

const bad = () => page('הקישור לא תקין', '<p>אולי הוא נחתך בהעתקה. אפשר לכבות את המיילים בעמוד <a href="/account/#notifications">החשבון שלי</a>, או לכתוב לנו ל־contact@shogi.co.il ונכבה אותם בשבילך.</p>', 400);

async function read(request: Request): Promise<{ u: string; k: string; t: string }> {
  const q = new URL(request.url).searchParams;
  let u = q.get('u') ?? '', k = q.get('k') ?? '', t = q.get('t') ?? '';
  if (request.method === 'POST') {
    try {
      const f = await request.formData();
      u = String(f.get('u') ?? u); k = String(f.get('k') ?? k); t = String(f.get('t') ?? t);
    } catch { /* one-click POSTs carry only List-Unsubscribe=One-Click; the link has the rest */ }
  }
  return { u, k, t };
}

export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  const { u, k, t } = await read(request);
  if (!secret || !(await checkUnsubscribe(secret, u, k, t))) return bad();
  const all = await unsubscribeToken(secret, u, 'all');
  const form = (kind: UnsubKind, token: string, label: string, ghost = false) =>
    `<form method="post" action="/api/unsubscribe"><input type="hidden" name="u" value="${u}"><input type="hidden" name="k" value="${kind}"><input type="hidden" name="t" value="${token}"><button${ghost ? ' class="ghost"' : ''}>${label}</button></form>`;
  return page('להפסיק את המיילים?', `<p>לחיצה אחת, ולא נשלח לך יותר: <strong>${NAME[k as UnsubKind]}</strong>.</p>
${form(k as UnsubKind, t, '⟦הפסק|הפסיקי⟧ את המיילים האלה')}${k !== 'all' ? form('all', all, '⟦הפסק|הפסיקי⟧ את כל המיילים', true) : ''}
<p style="font-size:15px">מיילים של החשבון עצמו (אישור כתובת, איפוס סיסמה) נשלחים רק ⟦כשאתה|כשאת⟧ ⟦מבקש|מבקשת⟧ אותם.</p>`);
}

export async function POST(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  const url = process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const { u, k, t } = await read(request);
  if (!secret || !(await checkUnsubscribe(secret, u, k, t))) return bad();
  if (!url || !serviceKey) return page('משהו השתבש', '<p>⟦נסה|נסי⟧ שוב בעוד כמה דקות, או ⟦כתוב|כתבי⟧ לנו ל־contact@shogi.co.il.</p>', 503);
  const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const off = k === 'week' ? { email_week: false } : k === 'return' ? { email_return: false } : { email_week: false, email_return: false };
  const { error } = await db.from('notification_prefs').update({ ...off, updated_at: new Date().toISOString() }).eq('user_id', u);
  if (error) {
    console.error('unsubscribe failed', error.message);
    return page('משהו השתבש', '<p>⟦נסה|נסי⟧ שוב בעוד כמה דקות, או ⟦כתוב|כתבי⟧ לנו ל־contact@shogi.co.il.</p>', 500);
  }
  await db.from('email_log').insert({ user_id: u, kind: 'unsubscribe' });
  return page('הפסקנו', `<p>לא נשלח לך יותר: <strong>${NAME[k as UnsubKind]}</strong>.</p>
<p>התחרטת? אפשר להדליק שוב בכל רגע בעמוד <a href="/account/#notifications">החשבון שלי</a>.</p>`);
}
