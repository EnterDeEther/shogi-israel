import { describe, expect, test } from 'bun:test';
import { afterPush, buildPush, duePush, isPublished, pushEndpointOk, type PushContext, type PushRow } from '../src/lib/push';
import { israelWeek } from '../src/lib/notify';
import { weekPuzzle } from '../src/tsume/week';

const at = (iso: string) => new Date(`${iso}T17:00:00Z`);
const SUN = at('2026-11-01');
const daysBefore = (d: Date, n: number) => new Date(d.getTime() - n * 864e5).toISOString();
const row = (r: Partial<PushRow> = {}): PushRow => ({
  endpoint: 'https://fcm.googleapis.com/fcm/send/abc', user_id: null, gender: 'm',
  push_week: false, push_course: false, push_news: false, last_push_at: null, week_sent: null,
  course_sent: 0, course_at: null, news_after: daysBefore(SUN, 30), ...r,
});
const ctx = (c: Partial<PushContext> = {}): PushContext => ({ now: SUN, weekCount: 1000, notices: [], ...c });
const placed = { course: { route: 'main', start: 'beginner' } };

describe('which push a phone gets today', () => {
  test('nothing when nothing is on', () => {
    expect(duePush(row(), ctx())).toBeNull();
  });

  test('puzzle of the week: Sundays only, once a week, not on Friday or Saturday', () => {
    expect(duePush(row({ push_week: true }), ctx())).toEqual({ kind: 'week' });
    expect(duePush(row({ push_week: true }), ctx({ now: at('2026-11-02') }))).toBeNull();
    expect(duePush(row({ push_week: true, week_sent: israelWeek(SUN) }), ctx())).toBeNull();
    expect(duePush(row({ push_week: true }), ctx({ now: at('2026-11-07') }))).toBeNull();
  });

  test('a signed-in player who already solved the week gets no puzzle push', () => {
    const solved = { tsume: { '3': [weekPuzzle(israelWeek(SUN), 1000)] } };
    expect(duePush(row({ push_week: true, user_id: 'u1' }), ctx({ progressData: solved }))).toBeNull();
  });

  test('at most one push a day', () => {
    expect(duePush(row({ push_week: true, last_push_at: daysBefore(SUN, 0.5) }), ctx())).toBeNull();
    expect(duePush(row({ push_week: true, last_push_at: daysBefore(SUN, 1) }), ctx())).toEqual({ kind: 'week' });
  });

  test('course reminder: signed in, after 3, 7, 14 days away, then quiet until a visit', () => {
    const r = (x: Partial<PushRow>) => row({ push_course: true, user_id: 'u1', ...x });
    const mon = at('2026-11-02');
    expect(duePush(r({}), ctx({ now: mon, progressData: placed, lastSeen: daysBefore(mon, 2) }))).toBeNull();
    expect(duePush(r({}), ctx({ now: mon, progressData: placed, lastSeen: daysBefore(mon, 3) }))).toEqual({ kind: 'course' });
    expect(duePush(r({ course_sent: 1, course_at: daysBefore(mon, 2) }), ctx({ now: mon, progressData: placed, lastSeen: daysBefore(mon, 5) }))).toBeNull();
    expect(duePush(r({ course_sent: 1, course_at: daysBefore(mon, 4) }), ctx({ now: mon, progressData: placed, lastSeen: daysBefore(mon, 7) }))).toEqual({ kind: 'course' });
    expect(duePush(r({ course_sent: 3, course_at: daysBefore(mon, 10) }), ctx({ now: mon, progressData: placed, lastSeen: daysBefore(mon, 30) }))).toBeNull();
    expect(duePush(r({ course_sent: 3, course_at: daysBefore(mon, 10) }), ctx({ now: mon, progressData: placed, lastSeen: daysBefore(mon, 4) }))).toEqual({ kind: 'course' });
    expect(duePush(r({ user_id: null }), ctx({ now: mon, progressData: placed, lastSeen: daysBefore(mon, 5) }))).toBeNull();
    expect(duePush(r({}), ctx({ now: mon, progressData: {}, lastSeen: daysBefore(mon, 5) }))).toBeNull();
  });

  test('news: a notice that went live after the last one sent, once', () => {
    const notice = { id: 7, title: 'טורניר ראשון', body: null, url: '/community/', starts_at: daysBefore(SUN, 1) };
    expect(duePush(row({ push_news: true }), ctx({ notices: [notice] }))).toEqual({ kind: 'news', notice });
    expect(duePush(row({ push_news: true, news_after: notice.starts_at }), ctx({ notices: [notice] }))).toBeNull();
    expect(duePush(row({ push_news: true, news_after: daysBefore(SUN, 0.5) }), ctx({ notices: [notice] }))).toBeNull();
    const due = duePush(row({ push_news: true }), ctx({ notices: [notice] }))!;
    expect(afterPush(row(), due, ctx()).news_after).toBe(notice.starts_at);
  });
});

test('only published news is pushed', () => {
  expect(isPublished({ status: 'published' })).toBe(true);
  expect(isPublished({})).toBe(true);
  for (const status of ['draft', 'waiting', 'archived']) expect(isPublished({ status })).toBe(false);
});

describe('what the push says', () => {
  test('in the reader\'s form, with a page on the site', () => {
    const m = buildPush({ kind: 'week' }, ctx(), 'f');
    expect(m.url).toBe('/tsume/3/');
    expect(m.body).toContain('תמצאי');
    expect(buildPush({ kind: 'week' }, ctx()).body).toContain('תמצא');
    const c = buildPush({ kind: 'course' }, ctx({ progressData: placed }));
    expect(c.url.startsWith('/')).toBe(true);
    expect(c.body).toContain('הצעד הבא');
    for (const x of [m, c]) expect(x.title + x.body).not.toContain('⟦');
  });
});

describe('only real push services', () => {
  test('the browsers\' push services pass, anything else is refused', () => {
    expect(pushEndpointOk('https://fcm.googleapis.com/fcm/send/xyz')).toBe(true);
    expect(pushEndpointOk('https://web.push.apple.com/QH2abc')).toBe(true);
    expect(pushEndpointOk('https://updates.push.services.mozilla.com/wpush/v2/abc')).toBe(true);
    expect(pushEndpointOk('https://evil.example/fcm.googleapis.com')).toBe(false);
    expect(pushEndpointOk('http://fcm.googleapis.com/x')).toBe(false);
    expect(pushEndpointOk('https://fcm.googleapis.com:8443/x')).toBe(false);
    expect(pushEndpointOk('https://fcm.googleapis.com.evil.example/x')).toBe(false);
    expect(pushEndpointOk(42)).toBe(false);
  });
});
