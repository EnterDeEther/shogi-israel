import { describe, expect, test } from 'bun:test';
import { TSUME_COUNTS } from '../src/lib/level-counts';
import { buildEmail, checkUnsubscribe, FROM, dueEmail, israelDay, unsubscribeToken, unsubscribeUrl, type PrefsRow } from '../src/lib/notify';
import { weekPuzzle } from '../src/tsume/week';
import { israelWeek } from '../src/lib/notify';

// 17:00 UTC = 19:00 in Israel (winter time)
const at = (iso: string) => new Date(`${iso}T17:00:00Z`);
const SUN = at('2026-11-01');
const daysBefore = (d: Date, n: number) => new Date(d.getTime() - n * 864e5).toISOString();
const row = (r: Partial<PrefsRow> = {}): PrefsRow => ({
  user_id: '00000000-0000-0000-0000-0000000000a1', email_week: true, email_return: false, paused_reason: null,
  last_seen_at: daysBefore(SUN, 1), return_sent: 0, last_email_at: null, ...r,
});

describe('who gets an email today', () => {
  test('Israel days, whatever the server clock', () => {
    expect(israelDay(SUN).weekday).toBe(0);
    expect(israelDay(new Date('2026-11-06T23:30:00Z')).weekday).toBe(6); // Friday night UTC is Saturday in Israel
  });

  test('the weekly email: Sunday to Thursday, never Friday or Saturday, at most every 6 days', () => {
    expect(dueEmail(row(), {}, SUN, 1000)).toBe('week');
    expect(dueEmail(row(), {}, at('2026-11-05'), 1000)).toBe('week'); // Thursday: still this week's
    expect(dueEmail(row(), {}, at('2026-11-06'), 1000)).toBeNull(); // Friday
    expect(dueEmail(row(), {}, at('2026-11-07'), 1000)).toBeNull(); // Saturday
    expect(dueEmail(row({ last_email_at: daysBefore(SUN, 3) }), {}, SUN, 1000)).toBeNull();
    expect(dueEmail(row({ last_email_at: daysBefore(SUN, 7) }), {}, SUN, 1000)).toBe('week');
  });

  test('nothing unless turned on, nothing while paused', () => {
    expect(dueEmail(row({ email_week: false }), {}, SUN, 1000)).toBeNull();
    expect(dueEmail(row({ paused_reason: 'bounce' }), {}, SUN, 1000)).toBeNull();
  });

  test('skipped when this week is already solved and they were here lately', () => {
    const solved = { tsume: { 3: [weekPuzzle(israelWeek(SUN), 1000)] } };
    expect(dueEmail(row(), solved, SUN, 1000)).toBeNull();
    expect(dueEmail(row({ last_seen_at: daysBefore(SUN, 10) }), solved, SUN, 1000, daysBefore(SUN, 10))).toBe('week');
  });

  test('come back: after 14 days, after 45, then never', () => {
    const away = (days: number, sent: number) =>
      dueEmail(row({ email_week: false, email_return: true, last_seen_at: daysBefore(SUN, days), return_sent: sent }), {}, SUN, 1000, daysBefore(SUN, days));
    expect(away(10, 0)).toBeNull();
    expect(away(14, 0)).toBe('return');
    expect(away(30, 1)).toBeNull();
    expect(away(45, 1)).toBe('return');
    expect(away(200, 2)).toBeNull();
  });

  test('a recent progress save counts as a visit', () => {
    const r = row({ email_week: false, email_return: true, last_seen_at: daysBefore(SUN, 30) });
    expect(dueEmail(r, {}, SUN, 1000, daysBefore(SUN, 2))).toBeNull();
  });
});

describe('the emails', () => {
  const base = { nickname: 'ShogiFan', weekCount: 1000, now: SUN, unsubscribeUrl: 'https://shogi.co.il/api/unsubscribe?u=x&k=week&t=y' };

  test('weekly: puzzle, next step, sender and unsubscribe; no "פרסומת" for free content', () => {
    const e = buildEmail({ ...base, kind: 'week', progressData: { course: { track: 'new', trackAt: 'x' } } });
    expect(e.subject).toBe('בעיית השבוע: מט בשלושה מהלכים');
    expect(e.html).toContain('dir="rtl"');
    expect(FROM).toStartWith('דין משוגי ישראל <');
    expect(e.html).toContain('דין, שוגי ישראל');
    expect(e.text).toContain('נתראה על הלוח,');
    expect(e.html).toContain('https://shogi.co.il/tsume/3/?utm_source=email');
    expect(e.html).toContain('/rules/01-board-pieces-setup/');
    expect(e.text).toContain('הפסקת המיילים האלה: https://shogi.co.il/api/unsubscribe');
    expect(e.text).toContain('contact@shogi.co.il');
  });

  test('come back: names the step, and the second one says it is the last', () => {
    const p = { course: { track: 'new', trackAt: 'x' }, rules: ['01-board-pieces-setup'] };
    expect(buildEmail({ ...base, kind: 'return', progressData: p, returnIndex: 0 }).subject).toContain('המסלול שלכם מחכה');
    expect(buildEmail({ ...base, kind: 'return', progressData: p, returnIndex: 1 }).text).toContain('התזכורת האחרונה');
  });

  test('names are escaped', () => {
    expect(buildEmail({ ...base, kind: 'week', progressData: {}, nickname: '<b>x' }).html).not.toContain('<b>x');
  });
});

describe('unsubscribe links', () => {
  const uid = '00000000-0000-0000-0000-0000000000a1';
  test('signed per player and kind', async () => {
    const t = await unsubscribeToken('s3cret', uid, 'week');
    expect(await checkUnsubscribe('s3cret', uid, 'week', t)).toBe(true);
    expect(await checkUnsubscribe('s3cret', uid, 'return', t)).toBe(false);
    expect(await checkUnsubscribe('other', uid, 'week', t)).toBe(false);
    expect(await checkUnsubscribe('s3cret', '00000000-0000-0000-0000-0000000000b2', 'week', t)).toBe(false);
    expect(await unsubscribeUrl('s3cret', uid, 'week')).toBe(`https://shogi.co.il/api/unsubscribe?u=${uid}&k=week&t=${t}`);
  });
});

test('tsume counts match the data files', async () => {
  for (const n of [1, 3, 5, 7]) {
    const data = (await import(`../src/tsume/data/mate${n}.json`)).default as unknown[];
    expect(TSUME_COUNTS[n]).toBe(data.length);
  }
});
