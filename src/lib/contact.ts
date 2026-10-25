// The contact form: field checks and the email it becomes. Shared by the form (src/components/ContactForm.astro)
// and the function that sends it (api/contact.ts), so both apply the same limits.

/** The public address. Contact-form messages go here too. */
export const CONTACT_EMAIL = 'contact@shogi.co.il';

/** The form shows only in builds that can send it (RESEND_API_KEY set in Vercel); until then pages show the email link. */
export const CONTACT_FORM_LIVE = typeof process !== 'undefined' && Boolean(process.env.RESEND_API_KEY);

/** Cloudflare Turnstile (bot check) public site key, for shogi.co.il and *.vercel.app. The secret stays in Vercel. */
export const TURNSTILE_SITE_KEY = '0x4AAAAAAFleBpVksiOS6Xuk';

export const LIMITS = { name: 80, email: 200, message: 4000, minMessage: 10 } as const;
/** A person needs a few seconds to fill the form; faster than this is a bot. */
export const MIN_FILL_MS = 3000;

export interface ContactInput {
  name: string;
  email: string;
  message: string;
}

export type ContactError = 'name' | 'email' | 'message' | 'spam';

const EMAIL_RE = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]{2,}$/;

/** Collapses line breaks and control characters, so a name can't add lines to the email's subject or headers. */
const oneLine = (s: string) => s.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim();

/**
 * Checks raw form fields. `website` is a hidden field people never fill; `startedAt` is when the form was shown (ms),
 * set by the page's script and absent without JavaScript.
 */
export function checkContact(
  fields: Record<string, unknown>,
  now = Date.now(),
): { ok: true; value: ContactInput } | { ok: false; error: ContactError } {
  const str = (k: string) => (typeof fields[k] === 'string' ? (fields[k] as string) : '');
  if (str('website') !== '') return { ok: false, error: 'spam' };
  const startedAt = Number(str('startedAt'));
  if (startedAt > 0 && now - startedAt < MIN_FILL_MS) return { ok: false, error: 'spam' };

  const name = oneLine(str('name'));
  const email = oneLine(str('email'));
  const message = str('message').replace(/\r\n?/g, '\n').trim();
  if (!name || name.length > LIMITS.name) return { ok: false, error: 'name' };
  if (email.length > LIMITS.email || !EMAIL_RE.test(email)) return { ok: false, error: 'email' };
  if (message.length < LIMITS.minMessage || message.length > LIMITS.message) return { ok: false, error: 'message' };
  return { ok: true, value: { name, email, message } };
}

/** The email that reaches the team. Plain text only, and replies go straight to the sender. */
export function contactEmail(input: ContactInput, to: string, from: string) {
  return {
    from,
    to: [to],
    reply_to: input.email,
    subject: `פנייה מהאתר: ${input.name}`,
    text: `${input.message}\n\n---\nמאת: ${input.name} <${input.email}>\nנשלח מטופס יצירת הקשר ב־shogi.co.il. כדי לענות, השיבו למייל הזה.`,
  };
}

/** Asks Cloudflare whether a Turnstile token is real, unused and from our site. Network errors count as a fail. */
export async function verifyTurnstile(token: string, secret: string, ip?: string | null, doFetch: typeof fetch = fetch) {
  if (!token) return false;
  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.set('remoteip', ip);
  try {
    const res = await doFetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}
