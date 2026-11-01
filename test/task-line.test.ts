import { expect, test } from 'bun:test';
import { categories } from '../src/learn/categories';

const levels = categories.flatMap((c) => c.stages.flatMap((s) => s.levels.map((l) => ({ at: `${s.key}:${l.id}`, goal: l.goal }))));

test('every level goal marks its task', () => {
  for (const { at, goal } of levels) expect(/==.+?==/.test(goal), `${at} has no ==task==: ${goal}`).toBe(true);
});

test('task marks are paired and never cut a word or a gender token', () => {
  for (const { at, goal } of levels) {
    expect((goal.match(/==/g) ?? []).length % 2, `${at} has an unpaired ==`).toBe(0);
    for (const m of goal.match(/==.+?==/g) ?? []) {
      const inner = m.slice(2, -2);
      expect((inner.match(/⟦/g) ?? []).length, `${at}: ${m}`).toBe((inner.match(/⟧/g) ?? []).length);
      expect((inner.match(/\*\*/g) ?? []).length % 2, `${at}: ${m}`).toBe(0);
    }
  }
});
