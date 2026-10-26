import { describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { categories } from '../src/learn/categories';
import { RULES_COURSE } from '../src/lib/course';
import { ALL_STEPS, CURRICULUM, nextStep, pathProgress, stepHref, stepState, stepsFor, unitProgress } from '../src/lib/curriculum';
import { merge, normalize, TRACKS, type SyncedProgress } from '../src/lib/progress-sync';

const stages = categories.flatMap((c) => c.stages);
const levelCounts = Object.fromEntries(stages.map((s) => [s.key, s.levels.length]));
const full = (key: string) => ({ scores: Array(levelCounts[key]).fill(3) });
const prog = (raw: object): SyncedProgress => normalize(raw);

describe('curriculum data', () => {
  test('every step points at something that exists', () => {
    const ids = new Set<string>();
    for (const s of ALL_STEPS) {
      expect(ids.has(s.id)).toBe(false);
      ids.add(s.id);
      if (s.kind === 'rules') expect(RULES_COURSE.some((l) => l.slug === s.rules)).toBe(true);
      if (s.kind === 'learn') for (const k of s.learn!) expect(levelCounts[k]).toBeGreaterThan(0);
      if (s.kind === 'tsume') expect([1, 3, 5, 7]).toContain(s.tsume!);
      if (s.kind === 'play') expect(s.play!).toBeGreaterThanOrEqual(1);
      if (s.kind === 'try' || s.kind === 'read') {
        const page = `src/pages${s.href!.replace(/#.*/, '').replace(/\/$/, '')}`;
        expect(existsSync(`${page}.astro`) || existsSync(`${page}/index.astro`)).toBe(true);
      }
    }
  });

  test('every rules lesson and every lesson stage is somewhere on the path', () => {
    for (const l of RULES_COURSE) expect(ALL_STEPS.some((s) => s.rules === l.slug)).toBe(true);
    for (const st of stages) expect(ALL_STEPS.some((s) => s.learn?.includes(st.key))).toBe(true);
  });

  test('basics first, then the three game phases in order', () => {
    expect(CURRICULUM.map((u) => u.key)).toEqual(['basics', 'opening', 'middle', 'endgame']);
    expect(CURRICULUM.map((u) => u.phase)).toEqual([undefined, 1, 2, 3]);
  });

  test('each starting point has a path with required steps in every phase', () => {
    for (const t of TRACKS) for (const u of CURRICULUM.filter((x) => x.phase)) {
      expect(unitProgress(u, prog({ course: { track: t, trackAt: 'x' } }), levelCounts).of).toBeGreaterThan(0);
    }
  });
});

describe('next step', () => {
  test('a new player starts by watching one game, then three pieces, then rules lesson 1', () => {
    expect(nextStep(prog({ course: { track: 'new', trackAt: 'x' } }), levelCounts)?.step.id).toBe('try-game');
    expect(nextStep(prog({ course: { track: 'new', trackAt: 'x', seen: ['try-game'] } }), levelCounts)?.step.id).toBe('try-pieces');
    expect(nextStep(prog({ course: { track: 'new', trackAt: 'x', seen: ['try-game', 'try-pieces'] } }), levelCounts)?.step.id).toBe('rules-01');
  });
  test('the first-step pages are only on the newcomer path', () => {
    const basics = CURRICULUM[0];
    for (const t of ['chess', 'shogi'] as const) expect(stepsFor(basics, t).some((s) => s.kind === 'try')).toBe(false);
    const p = prog({ course: { track: 'new', trackAt: 'x', seen: ['try-pieces'] } });
    const step = ALL_STEPS.find((s) => s.id === 'try-pieces')!;
    expect(stepState(step, p, levelCounts)).toBe('done');
    expect(stepHref(step, p, levelCounts)).toBe('/try/pieces/');
  });
  test('a chess player skips the board intro and the chess-like pieces', () => {
    expect(nextStep(prog({ course: { track: 'chess', trackAt: 'x' } }), levelCounts)?.step.id).toBe('rules-02');
  });
  test('someone who knows shogi starts at the opening', () => {
    const n = nextStep(prog({ course: { track: 'shogi', trackAt: 'x' } }), levelCounts);
    expect(n?.unit.key).toBe('opening');
    expect(n?.step.id).toBe('read-opening');
  });
  test('progress made elsewhere on the site moves the path on', () => {
    const p = prog({
      rules: ['01-board-pieces-setup'],
      learn: { stages: { introduction: full('introduction') } },
      course: { track: 'new', trackAt: 'x' },
    });
    expect(stepState(ALL_STEPS.find((s) => s.id === 'learn-intro')!, p, levelCounts)).toBe('done');
    // rules lesson 1 already done: the first-step pages count as passed, so nobody is sent back to them
    expect(stepState(ALL_STEPS.find((s) => s.id === 'try-game')!, p, levelCounts)).toBe('done');
    expect(nextStep(p, levelCounts)?.step.id).toBe('rules-02');
  });
  test('a learn step with several stages is done only when all are, and links to the first unfinished one', () => {
    const step = ALL_STEPS.find((s) => s.id === 'learn-new-pieces')!;
    const p = prog({ learn: { stages: { gold: full('gold'), silver: { scores: [3] } } } });
    expect(stepState(step, p, levelCounts)).toBe('todo');
    expect(stepHref(step, p, levelCounts)).toBe('/learn/silver/');
  });
  test('skipping counts for the path, tsume and play count from what was saved', () => {
    const p = prog({ course: { track: 'new', trackAt: 'x', skipped: ['rules-01'], played: 2, won: 0 }, tsume: { 1: Array.from({ length: 20 }, (_, i) => i + 1) } });
    const st = (id: string) => stepState(ALL_STEPS.find((s) => s.id === id)!, p, levelCounts);
    expect(st('rules-01')).toBe('skipped');
    expect(st('play-first')).toBe('done');
    expect(st('play-opening')).toBe('done');
    expect(st('play-middle')).toBe('todo');
    expect(st('tsume-1')).toBe('done');
    expect(st('play-win')).toBe('todo');
  });
  test('the chess step for the first game shows only for chess players', () => {
    const basics = CURRICULUM[0];
    expect(stepsFor(basics, 'chess').some((s) => s.id === 'play-first-chess')).toBe(true);
    expect(stepsFor(basics, 'chess').some((s) => s.id === 'play-first')).toBe(false);
    expect(stepsFor(basics, 'new').some((s) => s.id === 'play-first-chess')).toBe(false);
  });
  test('path progress counts required steps only', () => {
    const p = prog({ course: { track: 'new', trackAt: 'x' } });
    const t = pathProgress(p, levelCounts);
    expect(t.done).toBe(0);
    expect(t.of).toBeGreaterThan(20);
  });
});

describe('course sync', () => {
  test('the newer starting point wins, the rest is a union or the best of both', () => {
    const a = prog({ course: { track: 'new', trackAt: '2026-10-25T10:00:00Z', seen: ['read-opening'], played: 3, won: 1 }, tsume: { 1: [1, 2] } });
    const b = prog({ course: { track: 'chess', trackAt: '2026-10-25T12:00:00Z', skipped: ['rules-01'], played: 2, won: 2 }, tsume: { 1: [2, 5], 3: [1] } });
    const m = merge(a, b);
    expect(m.course).toEqual({ track: 'chess', trackAt: '2026-10-25T12:00:00Z', seen: ['read-opening'], skipped: ['rules-01'], played: 3, won: 2 });
    expect(m.tsume).toEqual({ 1: [1, 2, 5], 3: [1] });
    expect(merge(b, a).course.track).toBe('chess');
  });
  test('a chosen track beats none, whatever the time', () => {
    const a = prog({});
    const b = prog({ course: { track: 'shogi', trackAt: '2020-01-01T00:00:00Z' } });
    expect(merge(a, b).course.track).toBe('shogi');
    expect(merge(b, a).course.track).toBe('shogi');
  });
  test('junk in the course and tsume parts is dropped', () => {
    const p = normalize({ course: { track: 'pro', seen: [1, 'a'], played: 99, won: -2 }, tsume: { 1: [3, 3, -1, 'x', 1], x: [1] } });
    expect(p.course).toEqual({ track: null, trackAt: '', seen: ['a'], skipped: [], played: 10, won: 0 });
    expect(p.tsume).toEqual({ 1: [1, 3] });
  });
});
