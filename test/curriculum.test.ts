import { describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { initialSfen, parseSfen } from 'shogiops/sfen';
import { parseSquareName, parseUsi } from 'shogiops/util';
import { categories } from '../src/learn/categories';
import { RULES_COURSE } from '../src/lib/course';
import { ALL_STEPS, CHESS_CURRICULUM, CURRICULUM, LEVELS, curriculumFor, isKnown, isOptional, nextStep, pathProgress, placeFrom, placeLabel, stepHref, stepState, stepsFor, unitProgress } from '../src/lib/curriculum';
import { merge, normalize, type SyncedProgress } from '../src/lib/progress-sync';

const stages = categories.flatMap((c) => c.stages);
const levelCounts = Object.fromEntries(stages.map((s) => [s.key, s.levels.length]));
const full = (key: string) => ({ scores: Array(levelCounts[key]).fill(3) });
const prog = (raw: object): SyncedProgress => normalize(raw);
const placed = (route: string, start: string, extra: object = {}) => prog({ course: { route, start, placedAt: 'x', ...extra } });
const step = (id: string) => ALL_STEPS.find((s) => s.id === id)!;

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

  // The course copies Lishogi's map. Its units are the map's categories, in the map's order.
  test('the units follow the lesson map, category by category, then tsume', () => {
    expect(CURRICULUM.map((u) => u.key)).toEqual([...categories.map((c) => c.key), 'tsume']);
    for (const c of categories) expect(CURRICULUM.find((u) => u.key === c.key)!.level).toBe(c.level);
    // each map stage sits in its own category's unit
    for (const c of categories) {
      const unit = CURRICULUM.find((u) => u.key === c.key)!;
      for (const st of c.stages) expect(unit.steps.some((s) => s.learn?.includes(st.key))).toBe(true);
    }
    // Lishogi's own stages (the first four categories) appear exactly in map order
    const lishogi = categories.slice(0, 4).flatMap((c) => c.stages.map((st) => st.key));
    const order = ALL_STEPS.flatMap((s) => s.learn ?? []).filter((k) => lishogi.includes(k));
    expect(order).toEqual(lishogi);
  });

  test('three levels in order, and each one has units', () => {
    expect(LEVELS).toEqual(['beginner', 'intermediate', 'advanced']);
    const levels = CURRICULUM.map((u) => LEVELS.indexOf(u.level));
    expect(levels).toEqual([...levels].sort());
    for (const l of LEVELS) expect(CURRICULUM.some((u) => u.level === l)).toBe(true);
  });

  test('one piece per stage: each piece is its own step, in Lishogi order', () => {
    const pieces = CURRICULUM.find((u) => u.key === 'shogiPieces')!.steps.filter((s) => s.kind === 'learn').map((s) => s.learn);
    expect(pieces).toEqual([['king'], ['gold'], ['silver'], ['knight'], ['lance'], ['bishop'], ['rook'], ['pawn']]);
  });

  test('the rules lessons are optional reading on both routes', () => {
    for (const s of ALL_STEPS.filter((x) => x.kind === 'rules')) expect(s.optional).toEqual(['main', 'chess']);
  });
});

describe('next step', () => {
  test('a newcomer starts with the introduction stage, then the king', () => {
    expect(nextStep(placed('main', 'beginner'), levelCounts)?.step.id).toBe('learn-introduction');
    const p = prog({ course: { route: 'main', start: 'beginner', placedAt: 'x' }, learn: { stages: { introduction: full('introduction') } } });
    expect(nextStep(p, levelCounts)?.step.id).toBe('learn-king');
  });
  test('with no starting point the path is the main one from the start', () => {
    expect(nextStep(prog({}), levelCounts)?.step.id).toBe('learn-introduction');
  });
  test('a chess player gets the chess path: differences first, king, rook and bishop as known, first game at level 3', () => {
    const p = placed('chess', 'beginner', { seen: [] });
    expect(curriculumFor('chess')).toBe(CHESS_CURRICULUM);
    expect(nextStep(p, levelCounts)?.step.id).toBe('read-chess-diff');
    for (const id of ['learn-king', 'learn-rook', 'learn-bishop']) expect(isKnown(step(id), p.course)).toBe(true);
    for (const id of ['learn-king', 'learn-rook', 'learn-bishop']) expect(isKnown(step(id), placed('main', 'beginner').course)).toBe(false);
    expect(isKnown(step('learn-gold'), p.course)).toBe(false);
    const done = prog({ course: { route: 'chess', start: 'beginner', placedAt: 'x', seen: ['read-chess-diff'] }, learn: { stages: { introduction: full('introduction') } } });
    expect(nextStep(done, levelCounts)?.step.id).toBe('learn-gold');
    const ids = CHESS_CURRICULUM.flatMap((u) => u.steps.map((s) => s.id));
    expect(ids).toContain('play-first-chess');
    expect(ids).not.toContain('play-first');
    expect(CURRICULUM.flatMap((u) => u.steps.map((s) => s.id))).not.toContain('play-first-chess');
  });
  test('starting at intermediate: the beginner level is known, the path starts with board setup', () => {
    const p = placed('main', 'intermediate');
    expect(nextStep(p, levelCounts)?.step.id).toBe('learn-setup');
    for (const u of CURRICULUM.filter((x) => x.level === 'beginner')) expect(unitProgress(u, p, levelCounts).of).toBe(0);
  });
  test('starting at advanced: the path starts with piece value', () => {
    expect(nextStep(placed('main', 'advanced'), levelCounts)?.step.id).toBe('learn-value');
  });
  test('progress made elsewhere on the site moves the path on', () => {
    const p = prog({ course: { route: 'main', start: 'beginner', placedAt: 'x' }, learn: { stages: { introduction: full('introduction'), king: full('king') } } });
    expect(stepState(step('learn-introduction'), p, levelCounts)).toBe('done');
    expect(nextStep(p, levelCounts)?.step.id).toBe('learn-gold');
  });
  test('a learn step with several stages is done only when all are, and links to the first unfinished one', () => {
    const s = step('learn-more-plans');
    const p = prog({ learn: { stages: { chainedSilver: full('chainedSilver'), bishopClimbingSilver: { scores: [3] } } } });
    expect(stepState(s, p, levelCounts)).toBe('todo');
    expect(stepHref(s, p, levelCounts)).toBe('/learn/bishop-climbing-silver/');
  });
  test('skipping counts for the path, tsume and play count from what was saved', () => {
    const p = prog({ course: { route: 'main', start: 'beginner', placedAt: 'x', skipped: ['rules-01'], played: 2, won: 0 }, tsume: { 1: Array.from({ length: 20 }, (_, i) => i + 1) } });
    const st = (id: string) => stepState(step(id), p, levelCounts);
    expect(st('rules-01')).toBe('skipped');
    expect(st('play-first')).toBe('done');
    expect(st('play-opening')).toBe('done');
    expect(st('play-middle')).toBe('todo');
    expect(st('tsume-1')).toBe('done');
    expect(st('play-win')).toBe('todo');
  });
  test('a "known" mark on a step from before the redesign carries over to each of its stages', () => {
    const p = placed('main', 'beginner', { skipped: ['learn-chesslike'] });
    for (const id of ['learn-king', 'learn-rook', 'learn-bishop']) expect(stepState(step(id), p, levelCounts)).toBe('skipped');
    expect(stepState(step('learn-gold'), p, levelCounts)).toBe('todo');
  });
  test('path progress counts required steps only', () => {
    const t = pathProgress(placed('main', 'beginner'), levelCounts);
    expect(t.done).toBe(0);
    expect(t.of).toBeGreaterThan(30);
    expect(pathProgress(placed('main', 'advanced'), levelCounts).of).toBeLessThan(t.of);
  });
});

describe('the chess players\' path', () => {
  const chessSteps = CHESS_CURRICULUM.flatMap((u) => u.steps);
  const chessStages = chessSteps.flatMap((s) => s.learn ?? []);
  test('a step on both paths is the same lesson under the same id', () => {
    const mainSteps = CURRICULUM.flatMap((u) => u.steps);
    for (const s of chessSteps) {
      const m = mainSteps.find((x) => x.id === s.id);
      if (!m) continue;
      for (const k of ['kind', 'learn', 'rules', 'href', 'tsume', 'target', 'play', 'win'] as const) expect(s[k]).toEqual(m[k]);
    }
    expect(new Set(chessSteps.map((s) => s.id)).size).toBe(chessSteps.length);
    expect(new Set(CHESS_CURRICULUM.map((u) => u.key)).size).toBe(CHESS_CURRICULUM.length);
    for (const u of CHESS_CURRICULUM) expect(CURRICULUM.some((m) => m.key === u.key)).toBe(false); // unit ids are unique on /course/
  });
  test('three levels in order; every piece, drops, mate, setup, repetition and piece value are on it', () => {
    const levels = CHESS_CURRICULUM.map((u) => LEVELS.indexOf(u.level));
    expect(levels).toEqual([...levels].sort());
    for (const l of LEVELS) expect(CHESS_CURRICULUM.some((u) => u.level === l)).toBe(true);
    const beginner = categories.slice(0, 3).flatMap((c) => c.stages.map((st) => st.key));
    for (const k of [...beginner, 'setup', 'repetition', 'value']) expect(chessStages).toContain(k);
  });
  test('nothing is used before it is taught: the new pieces before capture, drops before mate, mate before value', () => {
    const at = (k: string) => chessStages.indexOf(k);
    for (const piece of ['king', 'gold', 'silver', 'knight', 'lance', 'bishop', 'rook', 'pawn']) expect(at(piece)).toBeLessThan(at('capture'));
    expect(at('introduction')).toBeLessThan(at('king'));
    expect(at('capture')).toBeLessThan(at('drop'));
    expect(at('drop')).toBeLessThan(at('check1'));
    expect(at('checkmate1')).toBeLessThan(at('value'));
    expect(at('value')).toBeLessThan(at('setup'));
    expect(at('rangingRook')).toBeLessThan(at('rangingCastles'));
  });
  test('only for chess players: no beginner board tour, no "how every piece moves" lesson, no level-1 first game', () => {
    const ids = chessSteps.map((s) => s.id);
    for (const id of ['try-pieces', 'rules-01', 'rules-02', 'play-first']) expect(ids).not.toContain(id);
  });
  test('the known pieces are optional there, and progress carries over between the paths', () => {
    const c = placed('chess', 'beginner');
    expect(isOptional(step('learn-king'), c.course)).toBe(true);
    expect(isOptional(step('learn-king'), placed('main', 'beginner').course)).toBe(false);
    // piece value is advanced on the main path and beginner on the chess path: starting at intermediate makes it known only there
    expect(isKnown(step('learn-value'), placed('chess', 'intermediate').course)).toBe(true);
    expect(isKnown(step('learn-value'), placed('main', 'intermediate').course)).toBe(false);
    const both = (route: string) => prog({ course: { route, start: 'beginner', placedAt: 'x' }, learn: { stages: { introduction: full('introduction'), gold: full('gold') } } });
    expect(stepState(step('learn-gold'), both('chess'), levelCounts)).toBe('done');
    expect(stepState(step('learn-gold'), both('main'), levelCounts)).toBe('done');
    expect(pathProgress(placed('chess', 'beginner'), levelCounts).of).toBeLessThan(pathProgress(placed('main', 'beginner'), levelCounts).of);
  });
  test('starting at intermediate on the chess path begins with board setup', () => {
    expect(nextStep(placed('chess', 'intermediate'), levelCounts)?.step.id).toBe('learn-setup');
    expect(nextStep(placed('chess', 'advanced'), levelCounts)?.step.id).toBe('read-strategy');
  });
});

describe('placement', () => {
  test('two answers set the route and the level; the board check moves the level', () => {
    expect(placeFrom('none', false)).toEqual({ route: 'main', start: 'beginner' });
    expect(placeFrom('none', true)).toEqual({ route: 'chess', start: 'beginner' });
    expect(placeFrom('rules', false)).toEqual({ route: 'main', start: 'intermediate' });
    expect(placeFrom('plays', true)).toEqual({ route: 'chess', start: 'intermediate' });
    expect(placeFrom('rules', false, 1).start).toBe('beginner');
    expect(placeFrom('plays', false, 2).start).toBe('intermediate');
    expect(placeFrom('plays', false, 3).start).toBe('advanced');
  });
  test('the starting point in words', () => {
    expect(placeLabel(placed('chess', 'intermediate').course)).toBe('בינוניים · מסלול לשחקני שחמט');
    expect(placeLabel(placed('main', 'beginner').course)).toBe('מתחילים');
    expect(placeLabel(prog({}).course)).toBe('');
  });

  // The three board-check positions on /course/ must say what the page says they say.
  test('the board check: a second pawn in a file is illegal, the gold drop in front mates, the ranging rook is the top one', () => {
    const q1 = parseSfen('standard', '4k4/9/9/9/9/9/4P4/9/4K4 b P 1').unwrap();
    expect(q1.isLegal(parseUsi('P*5d')!)).toBe(false);
    const q2 = parseSfen('standard', '4k4/9/4P4/9/9/9/9/9/4K4 b G 1').unwrap();
    for (const [usi, mate] of [['G*5b', true], ['G*4b', false], ['G*4a', false]] as const) {
      const p = q2.clone();
      p.play(parseUsi(usi)!);
      expect(p.outcome()?.result === 'checkmate').toBe(mate);
    }
    const q3 = parseSfen('standard', initialSfen('standard')).unwrap();
    for (const u of ['7g7f', '3c3d', '2g2f', '4c4d', '2f2e', '8b4b']) q3.play(parseUsi(u)!);
    expect(q3.board.get(parseSquareName('4b')!)?.role).toBe('rook'); // gote's rook has ranged to file 4
  });
});

describe('course sync', () => {
  test('the newer starting point wins, the rest is a union or the best of both', () => {
    const a = prog({ course: { route: 'main', start: 'beginner', placedAt: '2026-10-25T10:00:00Z', seen: ['read-opening'], played: 3, won: 1 }, tsume: { 1: [1, 2] } });
    const b = prog({ course: { route: 'chess', start: 'intermediate', placedAt: '2026-10-25T12:00:00Z', skipped: ['rules-01'], played: 2, won: 2 }, tsume: { 1: [2, 5], 3: [1] } });
    const m = merge(a, b);
    expect(m.course).toEqual({ route: 'chess', start: 'intermediate', placedAt: '2026-10-25T12:00:00Z', seen: ['read-opening'], skipped: ['rules-01'], played: 3, won: 2 });
    expect(m.tsume).toEqual({ 1: [1, 2, 5], 3: [1] });
    expect(merge(b, a).course.route).toBe('chess');
  });
  test('a chosen starting point beats none, whatever the time', () => {
    const a = prog({});
    const b = prog({ course: { route: 'main', start: 'advanced', placedAt: '2020-01-01T00:00:00Z' } });
    expect(merge(a, b).course.start).toBe('advanced');
    expect(merge(b, a).course.start).toBe('advanced');
  });
  // Accounts saved before the redesign (2026-10-27) keep their answer.
  test('the old one-answer track maps onto a route and a level', () => {
    expect(prog({ course: { track: 'new', trackAt: 't' } }).course).toMatchObject({ route: 'main', start: 'beginner', placedAt: 't' });
    expect(prog({ course: { track: 'chess', trackAt: 't' } }).course).toMatchObject({ route: 'chess', start: 'beginner' });
    expect(prog({ course: { track: 'shogi', trackAt: 't' } }).course).toMatchObject({ route: 'main', start: 'intermediate' });
    expect(prog({ course: { track: null, trackAt: '' } }).course).toMatchObject({ route: null, start: null, placedAt: '' });
  });
  test('junk in the course and tsume parts is dropped', () => {
    const p = normalize({ course: { route: 'pro', start: 'beginner', seen: [1, 'a'], played: 99, won: -2 }, tsume: { 1: [3, 3, -1, 'x', 1], x: [1] } });
    expect(p.course).toEqual({ route: null, start: null, placedAt: '', seen: ['a'], skipped: [], played: 10, won: 0 });
    expect(p.tsume).toEqual({ 1: [1, 3] });
  });
});
