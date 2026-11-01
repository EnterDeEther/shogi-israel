import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { ACCOUNT_TOUR, SITE_TOUR, TOUR_KEY, counter, isTourId, readTourEnd, stepsFor, writeTourEnd } from '../src/lib/tour';

const memory = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
};

describe('site tour', () => {
  test('starts at the first game and ends on people', () => {
    expect(SITE_TOUR.steps[0].target).toBe('try');
    expect(SITE_TOUR.steps.at(-1)!.target).toBe('community');
  });

  test('every menu step points at a menu section that carries its tour key', () => {
    const keys = [...readFileSync(new URL('../src/lib/nav.ts', import.meta.url), 'utf8').matchAll(/tour: '(\w+)'/g)].map((m) => m[1]);
    for (const s of SITE_TOUR.steps) if (!['try', 'quick', 'account'].includes(s.target)) expect(keys).toContain(s.target);
  });

  test('a step whose target is not on the page is left out, and the counter follows', () => {
    const steps = stepsFor(SITE_TOUR.steps, (t) => t !== 'account');
    expect(steps.map((s) => s.target)).toEqual(['try', 'learn', 'play', 'quick', 'know', 'community']);
    expect(counter(2, steps.length)).toBe('צעד 2 מתוך 6');
    expect(SITE_TOUR.intro.body(steps.length).startsWith('שישה צעדים')).toBe(true);
  });

  test('a learning rank is always explained on /ranks/', () => {
    const account = SITE_TOUR.steps.find((s) => s.target === 'account')!;
    expect(account.body).toContain('דרגות לימוד');
    expect(account.link?.href).toBe('/ranks/#site');
    const rank = ACCOUNT_TOUR.steps.find((s) => s.target === 'rank')!;
    expect(rank.body).toContain('לא דרגה רשמית');
    expect(rank.link?.href).toBe('/ranks/#site');
  });

  test('the account tour walks the learner home and the header', () => {
    expect(ACCOUNT_TOUR.steps.map((s) => s.target)).toEqual(['next', 'rank', 'bell', 'account']);
    expect(ACCOUNT_TOUR.intro.body(4).startsWith('ארבעה צעדים')).toBe(true);
    expect(isTourId('account')).toBe(true);
    expect(isTourId('admin')).toBe(false);
    expect(isTourId(null)).toBe(false);
  });

  test('no step promises an event or a meetup', () => {
    const text = JSON.stringify([SITE_TOUR, ACCOUNT_TOUR]);
    for (const w of ['מפגש', 'אירוע', 'ערב שוגי']) expect(text).not.toContain(w);
  });

  test('remembers how the tour ended, and survives a broken or missing store', () => {
    const s = memory();
    expect(readTourEnd(s)).toBeNull();
    writeTourEnd(s, 'skipped', 'site', new Date('2026-10-26T14:00:00Z'));
    expect(readTourEnd(s)).toBe('skipped');
    expect(readTourEnd(s, 'account')).toBeNull();
    writeTourEnd(s, 'done', 'account');
    expect(readTourEnd(s, 'account')).toBe('done');
    expect(readTourEnd(s, 'site')).toBe('skipped');
    expect(JSON.parse(s.m.get(TOUR_KEY)!).site.at).toBe('2026-10-26T14:00:00.000Z');
    s.m.set(TOUR_KEY, '{oops');
    expect(readTourEnd(s)).toBeNull();
    expect(readTourEnd(undefined)).toBeNull();
    expect(() => writeTourEnd(undefined, 'done')).not.toThrow();
  });
});
