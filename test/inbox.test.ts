import { describe, expect, test } from 'bun:test';
import { buildInbox, GROUP_OF, openGameFrom, unread } from '../src/lib/inbox';
import { LEVEL_COUNTS } from '../src/lib/level-counts';
import { merge, normalize, INBOX_READ_MAX } from '../src/lib/progress-sync';
import { weekIndex, weekPuzzle } from '../src/tsume/week';

const SUNDAY = new Date(2026, 9, 25, 12, 0); // a Sunday
const THURSDAY = new Date(2026, 9, 29, 12, 0);
const ctx = (extra: object = {}) => ({ levelCounts: LEVEL_COUNTS, weekCount: 1000, now: SUNDAY, ...extra });
const kinds = (raw: object, extra: object = {}) => buildInbox(normalize(raw), ctx(extra)).map((n) => n.kind);

describe('inbox notes', () => {
  test('a new account: choose a starting point and the puzzle of the week', () => {
    expect(kinds({})).toEqual(['week', 'next']);
    expect(buildInbox(normalize({}), ctx()).find((n) => n.kind === 'next')!.href).toBe('/course/');
  });

  test('the next step on the path, and a rank once there are points', () => {
    const notes = buildInbox(normalize({ course: { track: 'new', trackAt: 'x' }, rules: ['01-board-pieces-setup', '02-how-pieces-move'] }), ctx());
    const next = notes.find((n) => n.kind === 'next')!;
    expect(next.id).toBe('next:learn-intro');
    expect(next.href).toBe('/learn/introduction/');
    expect(notes.find((n) => n.kind === 'rank')!.id).toMatch(/^rank:\d+$/);
  });

  test('a half-finished stage shows, unless it is already the next step', () => {
    const p = { course: { track: 'new', trackAt: 'x' }, learn: { stages: { protection: { scores: [3, 2] } } } };
    const stage = buildInbox(normalize(p), ctx()).find((n) => n.kind === 'stage')!;
    expect(stage.id).toBe('stage:protection');
    expect(stage.href).toBe('/learn/protection/');
    expect(stage.text).toContain(`${LEVEL_COUNTS.protection - 2} תרגילים`);
    const first = { course: { track: 'new', trackAt: 'x' }, rules: ['01-board-pieces-setup'], learn: { stages: { introduction: { scores: [3] } } } };
    expect(kinds(first)).not.toContain('stage'); // introduction is the next step itself
  });

  test('the weekly puzzle disappears once solved; a streak warning from Thursday', () => {
    const w = weekIndex(THURSDAY);
    const lastTwo = [weekPuzzle(w - 1, 1000), weekPuzzle(w - 2, 1000)];
    expect(kinds({ tsume: { 3: lastTwo } }, { now: THURSDAY })).toContain('streak');
    expect(kinds({ tsume: { 3: lastTwo } }, { now: SUNDAY })).toContain('week');
    expect(kinds({ tsume: { 3: [...lastTwo, weekPuzzle(w, 1000)] } }, { now: THURSDAY })).not.toContain('streak');
    expect(kinds({ tsume: { 3: [...lastTwo, weekPuzzle(w, 1000)] } }, { now: THURSDAY })).not.toContain('week');
  });

  test('open game, site news, and the settings switches', () => {
    const extra = { openGame: { id: 'abc', level: 3, moves: 12 }, notices: [{ id: 7, title: 'שיעור חדש', url: '/learn/' }] };
    const all = buildInbox(normalize({}), ctx(extra));
    expect(all.map((n) => n.id)).toEqual(expect.arrayContaining(['game:abc', 'news:7']));
    const off = buildInbox(normalize({ inbox: { off: ['path', 'news', 'week'] } }), ctx(extra));
    expect(off.every((n) => GROUP_OF[n.kind] === 'rank')).toBe(true);
  });

  test('read notes are not counted as new', () => {
    const p = normalize({ inbox: { read: [`week:${weekIndex(SUNDAY)}`] } });
    expect(unread(buildInbox(p, ctx()), p).map((n) => n.kind)).toEqual(['next']);
  });

  test('the saved game in progress', () => {
    const rec = { id: 'g1', version: 1, level: 2, moves: ['7g7f', '3c3d'] };
    expect(openGameFrom(JSON.stringify({ record: rec }))).toEqual({ id: 'g1', level: 2, moves: 2 });
    expect(openGameFrom(JSON.stringify({ record: { ...rec, result: { winner: 'sente' } } }))).toBeNull();
    expect(openGameFrom('nonsense')).toBeNull();
    expect(openGameFrom(null)).toBeNull();
  });
});

describe('inbox sync', () => {
  test('read marks are joined, the newer settings win', () => {
    const a = normalize({ inbox: { read: ['a', 'b'], off: ['news'], offAt: '2026-10-25T10:00:00Z' } });
    const b = normalize({ inbox: { read: ['b', 'c'], off: [], offAt: '2026-10-25T12:00:00Z' } });
    expect(merge(a, b).inbox).toEqual({ read: ['a', 'b', 'c'], off: [], offAt: '2026-10-25T12:00:00Z' });
    expect(merge(b, a).inbox.off).toEqual([]);
  });

  test('normalize keeps the read list short and drops junk', () => {
    const read = Array.from({ length: INBOX_READ_MAX + 50 }, (_, i) => `n:${i}`);
    const p = normalize({ inbox: { read: [...read, 5, 'x'.repeat(65)], off: ['news', 'bogus'] } });
    expect(p.inbox.read.length).toBe(INBOX_READ_MAX);
    expect(p.inbox.read.at(-1)).toBe(`n:${INBOX_READ_MAX + 49}`);
    expect(p.inbox.off).toEqual(['news']);
  });
});
