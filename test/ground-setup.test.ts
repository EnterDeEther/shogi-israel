// Every board page builds shogiground the same way: liveBounds() so presses land on the piece under the finger
// (src/lib/live-bounds.ts), and SQUARE_RATIO so circles and arrows sit on their squares (src/lib/square-ratio.ts).
import { expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return sources(p);
    return /\.(ts|astro)$/.test(e.name) ? [p] : [];
  });
}

// a call (Shogiground({...}) or Shogiground(config)), not the word in a comment
const CALL = /\bShogiground\((?=[{a-z])/g;
const boards = sources('src').filter((p) => readFileSync(p, 'utf8').search(CALL) >= 0);

test('board pages are found', () => {
  expect(boards.length).toBeGreaterThanOrEqual(6);
});

test('every Shogiground() is wrapped with liveBounds()', () => {
  for (const p of boards) {
    const src = readFileSync(p, 'utf8');
    expect((src.match(CALL) ?? []).length, p).toBe((src.match(/liveBounds\(Shogiground\(/g) ?? []).length);
  }
});

test('every board passes SQUARE_RATIO', () => {
  // the lesson board's config lives in learn/ground.ts
  const files = boards.map((p) => (p.endsWith('learn/ctrl.ts') ? p.replace('ctrl.ts', 'ground.ts') : p));
  for (const p of files) expect(readFileSync(p, 'utf8'), p).toContain('squareRatio: SQUARE_RATIO');
});
