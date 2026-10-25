// Shogi Israel: the tsume collections and what this device has solved.
// Puzzles live in data/mate<N>.json as [sfen, line] pairs (line = the main line in USI, space separated),
// easiest first. Made by scripts/tsume/gen.py and checked by test/tsume.test.ts.
// AGPL-3.0-or-later, like the rest of this site.
import { storage } from '../learn/storage';

export interface Puzzle {
  sfen: string;
  line: string[];
}

export const LENGTHS = [1, 3, 5, 7] as const;
export type Length = (typeof LENGTHS)[number];

export const LENGTH_INFO: Record<Length, { title: string; sub: string }> = {
  1: { title: 'מט במהלך אחד', sub: 'מהלך אחד, ישר למט. מתחילים כאן.' },
  3: { title: 'מט ב־3 מהלכים', sub: 'שח, תשובה של המגן, ומט.' },
  5: { title: 'מט ב־5 מהלכים', sub: 'כאן מתחילות ההקרבות.' },
  7: { title: 'מט ב־7 מהלכים', sub: 'לשחקנים עם ניסיון.' },
};

const loaders: Record<Length, () => Promise<{ default: [string, string][] }>> = {
  1: () => import('./data/mate1.json'),
  3: () => import('./data/mate3.json'),
  5: () => import('./data/mate5.json'),
  7: () => import('./data/mate7.json'),
};

export async function loadPuzzles(n: Length): Promise<Puzzle[]> {
  const data = (await loaders[n]()).default;
  return data.map(([sfen, line]) => ({ sfen, line: line.split(' ') }));
}

// ---------- progress on this device: puzzle numbers (1-based) solved per length

const KEY = 'tsume.solved';
type Solved = Partial<Record<Length, number[]>>;

const read = (): Solved => {
  try {
    return JSON.parse(storage.get(KEY) || '{}');
  } catch {
    return {};
  }
};

export const solvedList = (n: Length): number[] => read()[n] ?? [];

export function markSolved(n: Length, id: number): void {
  const all = read();
  const list = new Set(all[n] ?? []);
  list.add(id);
  all[n] = [...list].sort((a, b) => a - b);
  storage.set(KEY, JSON.stringify(all));
}

/** The first puzzle not solved yet, from `from` on (wraps around); 1 when all are solved. */
export function nextUnsolved(n: Length, count: number, from = 1): number {
  const done = new Set(solvedList(n));
  for (let i = 0; i < count; i++) {
    const id = ((from - 1 + i) % count) + 1;
    if (!done.has(id)) return id;
  }
  return 1;
}
