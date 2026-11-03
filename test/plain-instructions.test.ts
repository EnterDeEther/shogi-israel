import { expect, test } from 'bun:test';
import { stages } from '../src/learn/categories';
import { hintShapes, nextMoveShapes, nextOrder } from '../src/learn/describe';
import he from '../src/learn/i18n/he.json';

const NOTATION = /\+?[KRBGSNLP](?:\d\d)?[-x*]\d\d\+?/;

test('lesson texts never use move notation', () => {
  for (const s of stages) {
    const texts = [s.intro, s.complete, ...s.levels.flatMap((l) => [l.goal, ...(l.why ?? []), ...(l.replies ?? []), ...(l.moveNames ?? []), ...(l.moveOrders ?? []), ...(l.replyNames ?? [])])];
    for (const t of texts) expect(t, `${s.key}: ${t}`).not.toMatch(NOTATION);
  }
  for (const [k, v] of Object.entries(he)) if (k.startsWith('il_') && typeof v === 'string') expect(v, k).not.toMatch(NOTATION);
});

test('every guided move has a Hebrew order, and the arrow waits for the hint button', () => {
  let guided = 0;
  for (const s of stages)
    for (const l of s.levels) {
      if (!l.moveOrders || !l.scenario) continue;
      const mine = l.scenario.filter((u) => u.color === l.color).length;
      expect(l.moveOrders.length, `${s.key} #${l.id}`).toBe(mine);
      expect(l.moveNames!.length, `${s.key} #${l.id}`).toBe(mine);
      for (let i = 0; i < l.scenario.length; i++) {
        if (l.scenario[i].color !== l.color) continue;
        const done = l.scenario.slice(0, i);
        const order = nextOrder(l, done);
        expect(order, `${s.key} #${l.id} ply ${i}`).toBeTruthy();
        expect(order!).toMatch(/^⟦/);
        expect(hintShapes(l, done).length, `${s.key} #${l.id} ply ${i}`).toBe(1);
        expect(nextMoveShapes(l, done).length, `${s.key} #${l.id} ply ${i}`).toBe(0);
        expect(order!).not.toMatch(/חץ|עיגול/);
        guided++;
      }
    }
  expect(guided).toBeGreaterThan(200);
});
