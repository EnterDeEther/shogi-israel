import { describe, expect, test } from 'bun:test';
import { adLabel, buildReport, reportEmail, reportsDue, signupEmail, totals, type PlayerInput } from '../src/lib/admin-report';

const NOW = new Date('2026-11-02T06:00:00Z');
const ago = (days: number) => new Date(NOW.getTime() - days * 864e5).toISOString();
const player = (p: Partial<PlayerInput> = {}): PlayerInput => ({
  id: 'u1', nickname: 'kenji', created_at: ago(10), confirmed: true, progress: null, progress_at: null,
  games: 0, wins: 0, last_game_at: null, last_seen_at: null, email_week: false, ...p,
});
const progress = { rules: ['01-board-pieces-setup', '02-moves'], learn: { stages: { king: { scores: [3, 3, 2] } } }, tsume: { 1: [1, 2] } };

describe('admin reports', () => {
  test('totals come from the saved progress', () => {
    const t = totals(player({ progress, games: 2, wins: 1 }));
    expect(t.rules_done).toBe(2);
    expect(t.levels_done).toBe(3);
    expect(t.tsume_solved).toBe(2);
    expect(t.games).toBe(2);
    expect(t.xp).toBeGreaterThan(0);
  });

  test('a player who moved up since the snapshot is active, with the change and the new rank', () => {
    const before = new Map([['u1', { xp: 0, levels_done: 0, rules_done: 0, tsume_solved: 0, games: 0, wins: 0 }]]);
    const r = buildReport('daily', [player({ progress }), player({ id: 'u2', nickname: 'yuki' })], before, NOW);
    expect(r.active.map((l) => l.nickname)).toEqual(['kenji']);
    expect(r.active[0].delta.rules_done).toBe(2);
    expect(r.active[0].rankUp).not.toBeNull();
    expect(r.idle.map((l) => l.nickname)).toEqual(['yuki']);
    expect(r.insights.join(' ')).toContain('yuki');
  });

  test('new sign-ups count, even with nothing done yet; the first report says changes come later', () => {
    const r = buildReport('weekly', [player({ created_at: ago(2), nickname: null, confirmed: false })], null, NOW);
    expect(r.newCount).toBe(1);
    expect(r.unconfirmed).toBe(1);
    expect(r.active[0].isNew).toBe(true);
    expect(r.baseline).toBe(true);
    expect(r.insights.join(' ')).toContain('הדוח הראשון');
  });

  test('a visit counts as active without progress', () => {
    const r = buildReport('daily', [player({ last_seen_at: ago(0.5) })], new Map(), NOW);
    expect(r.active).toHaveLength(1);
  });

  test('emails escape nicknames and name every player', () => {
    const r = buildReport('daily', [player({ nickname: '<b>x</b>' }), player({ id: 'u2', nickname: 'yuki', created_at: ago(0.2) })], new Map(), NOW);
    const e = reportEmail(r);
    expect(e.html).not.toContain('<b>x</b>');
    expect(e.text).toContain('yuki');
    expect(e.subject).toContain('1 נרשמו');
    const s = signupEmail([{ nickname: 'yuki', created_at: ago(0), total: 4, email_week: true }]);
    expect(s.subject).toContain('yuki');
    expect(s.text).toContain('4 חשבונות');
  });

  test('the ad that brought a player shows on the alert and per campaign in the weekly report', () => {
    expect(adLabel({ source: 'google', medium: 'display', campaign: 'display_a', landing: '/try/' })).toBe('google / display / display_a');
    expect(adLabel(undefined)).toBeNull();
    const s = signupEmail([{ nickname: 'yuki', created_at: ago(0), total: 4, email_week: false, ad: 'google / display / display_a' }]);
    expect(s.text).toContain('הגיע ממודעה: google / display / display_a');
    const r = buildReport('weekly', [
      player({ id: 'a', created_at: ago(1), ad: 'google / display / display_a' }),
      player({ id: 'b', created_at: ago(2), ad: 'google / display / display_a' }),
      player({ id: 'c', created_at: ago(3) }),
    ], new Map(), NOW);
    expect(r.insights.join(' ')).toContain('נרשמו לפי קמפיין: google / display / display_a 2, בלי מודעה 1.');
    expect(buildReport('daily', [player({ created_at: ago(0.5), ad: 'x' })], new Map(), NOW).insights.join(' ')).not.toContain('קמפיין');
  });

  test('the weekly report goes on Sundays (Israel time)', () => {
    expect(reportsDue(new Date('2026-11-01T06:00:00Z'))).toEqual(['daily', 'weekly']);
    expect(reportsDue(NOW)).toEqual(['daily']);
  });
});
