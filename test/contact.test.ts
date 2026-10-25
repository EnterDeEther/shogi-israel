import { describe, expect, test } from 'bun:test';
import { checkContact, contactEmail, LIMITS, MIN_FILL_MS, verifyTurnstile } from '../src/lib/contact';

const good = { name: 'דנה', email: 'dana@example.com', message: 'שלום, מצאתי טעות בשיעור 2.' };

describe('checkContact', () => {
  test('accepts a normal message', () => {
    expect(checkContact(good)).toEqual({ ok: true, value: good });
  });
  test('rejects a filled honeypot or a too-fast submit as spam', () => {
    expect(checkContact({ ...good, website: 'x' })).toEqual({ ok: false, error: 'spam' });
    const now = 1_000_000;
    expect(checkContact({ ...good, startedAt: String(now - 500) }, now)).toEqual({ ok: false, error: 'spam' });
    expect(checkContact({ ...good, startedAt: String(now - MIN_FILL_MS) }, now).ok).toBe(true);
  });
  test('names the bad field', () => {
    expect(checkContact({ ...good, name: '  ' })).toEqual({ ok: false, error: 'name' });
    expect(checkContact({ ...good, name: 'א'.repeat(LIMITS.name + 1) })).toEqual({ ok: false, error: 'name' });
    expect(checkContact({ ...good, email: 'not-an-email' })).toEqual({ ok: false, error: 'email' });
    expect(checkContact({ ...good, email: 'a@b.com, c@d.com' })).toEqual({ ok: false, error: 'email' });
    expect(checkContact({ ...good, message: 'קצר' })).toEqual({ ok: false, error: 'message' });
    expect(checkContact({ ...good, message: 'א'.repeat(LIMITS.message + 1) })).toEqual({ ok: false, error: 'message' });
    expect(checkContact({ name: 5, email: [], message: {} })).toEqual({ ok: false, error: 'name' });
  });
  test('keeps line breaks out of the name and email', () => {
    const r = checkContact({ ...good, name: 'דנה\r\nBcc: x@y.com' });
    expect(r.ok && r.value.name).toBe('דנה Bcc: x@y.com');
  });
});

describe('contactEmail', () => {
  test('sends plain text to the team with Reply-To set to the sender', () => {
    const m = contactEmail(good, 'contact@shogi.co.il', 'שוגי ישראל <noreply@shogi.co.il>');
    expect(m.to).toEqual(['contact@shogi.co.il']);
    expect(m.reply_to).toBe('dana@example.com');
    expect(m.subject).toBe('פנייה מהאתר: דנה');
    expect(m.text.startsWith(good.message)).toBe(true);
  });
});

describe('verifyTurnstile', () => {
  const fakeFetch = (success: boolean, seen: { body?: URLSearchParams } = {}) =>
    (async (_url: unknown, init: { body: URLSearchParams }) => {
      seen.body = init.body;
      return new Response(JSON.stringify({ success }));
    }) as unknown as typeof fetch;

  test('passes only when Cloudflare says success', async () => {
    const seen: { body?: URLSearchParams } = {};
    expect(await verifyTurnstile('tok', 'sec', '1.2.3.4', fakeFetch(true, seen))).toBe(true);
    expect(seen.body?.get('response')).toBe('tok');
    expect(seen.body?.get('remoteip')).toBe('1.2.3.4');
    expect(await verifyTurnstile('tok', 'sec', null, fakeFetch(false))).toBe(false);
  });
  test('fails without a token or when the network fails', async () => {
    expect(await verifyTurnstile('', 'sec', null, fakeFetch(true))).toBe(false);
    const broken = (async () => { throw new Error('down'); }) as unknown as typeof fetch;
    expect(await verifyTurnstile('tok', 'sec', null, broken)).toBe(false);
  });
});
