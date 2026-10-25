// Vercel Function: POST /api/contact. Sends a contact-form message to CONTACT_EMAIL through Resend.
// Needs the RESEND_API_KEY environment variable (a Resend key with sending access for shogi.co.il).
import { CONTACT_EMAIL, checkContact, contactEmail } from '../src/lib/contact';

const FROM = 'שוגי ישראל <noreply@shogi.co.il>';
const ALLOWED_ORIGIN = /^https:\/\/((www\.)?shogi\.co\.il|shogi-israel-[a-z0-9-]+-enterdeether\.vercel\.app)$/;

export async function POST(request: Request): Promise<Response> {
  // With JavaScript the form asks for JSON; without it, the browser posts the form and gets sent back to the page.
  const wantsJson = (request.headers.get('accept') ?? '').includes('application/json');
  const reply = (status: number, result: 'sent' | 'error' | 'invalid', error?: string) =>
    wantsJson
      ? Response.json({ ok: result === 'sent', error }, { status })
      : new Response(null, { status: 303, headers: { Location: `/about/?contact=${result}#contact` } });

  const origin = request.headers.get('origin');
  if (origin && !ALLOWED_ORIGIN.test(origin)) return reply(403, 'error', 'origin');

  let fields: Record<string, unknown>;
  try {
    const type = request.headers.get('content-type') ?? '';
    fields = type.includes('application/json')
      ? await request.json()
      : Object.fromEntries((await request.formData()).entries());
  } catch {
    return reply(400, 'invalid', 'body');
  }

  const checked = checkContact(fields);
  // Bots get the same answer as people, so they learn nothing.
  if (!checked.ok) return checked.error === 'spam' ? reply(200, 'sent') : reply(400, 'invalid', checked.error);

  const key = process.env.RESEND_API_KEY;
  if (!key) return reply(503, 'error', 'not-configured');

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(contactEmail(checked.value, CONTACT_EMAIL, FROM)),
  });
  if (!res.ok) {
    console.error('contact: resend failed', res.status, await res.text());
    return reply(502, 'error', 'send');
  }
  return reply(200, 'sent');
}
