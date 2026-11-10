import { describe, expect, test } from 'bun:test';
import { AFTER_COURSE, finishedCourse, nextLevel } from '../src/lib/after-course';
import { ALL_STEPS, curriculumFor, stepsFor } from '../src/lib/curriculum';
import { LEVEL_COUNTS } from '../src/lib/level-counts';
import { RULES_COURSE } from '../src/lib/course';
import { normalize, type Route } from '../src/lib/progress-sync';

const full = (route: Route | null, won = 4) => normalize({
  learn: { stages: Object.fromEntries(Object.entries(LEVEL_COUNTS).map(([k, n]) => [k, { scores: Array(n).fill(3) }])) },
  rules: RULES_COURSE.map((l) => l.slug),
  tsume: { 1: Array.from({ length: 20 }, (_, i) => i + 1), 3: Array.from({ length: 10 }, (_, i) => i + 1), 5: Array.from({ length: 5 }, (_, i) => i + 1) },
  course: { route, start: route ? 'beginner' : null, placedAt: route ? '2026-11-01T00:00:00Z' : '', seen: ALL_STEPS.filter((s) => s.kind === 'try' || s.kind === 'read').map((s) => s.id), skipped: [], played: 4, won },
});

describe('after the course', () => {
  test('finished on both routes and as a guest', () => {
    expect(finishedCourse(full('main'), LEVEL_COUNTS)).toBe(true);
    expect(finishedCourse(full('chess'), LEVEL_COUNTS)).toBe(true);
    expect(finishedCourse(full(null), LEVEL_COUNTS)).toBe(true);
  });

  test('one step left is not finished', () => {
    expect(finishedCourse(full('main', 3), LEVEL_COUNTS)).toBe(false);
  });

  test('skipping everything is not finishing', () => {
    const p = normalize({ course: { route: 'main', start: 'beginner', placedAt: '2026-11-01T00:00:00Z', skipped: curriculumFor('main').flatMap((u) => stepsFor(u, { route: 'main', start: 'beginner' })).map((s) => s.id) } });
    expect(finishedCourse(p, LEVEL_COUNTS)).toBe(false);
  });

  test('computer level suggestion starts at 5 and stops at 10', () => {
    expect(nextLevel(4)).toBe(5);
    expect(nextLevel(7)).toBe(8);
    expect(nextLevel(10)).toBe(10);
  });

  test('every next step has a link and a call to action', () => {
    for (const it of AFTER_COURSE) {
      expect(it.href.length).toBeGreaterThan(0);
      expect(it.cta.length).toBeGreaterThan(0);
      if (it.href.startsWith('/')) expect(it.href.split(/[?#]/)[0].endsWith('/')).toBe(true);
    }
  });
});
