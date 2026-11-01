// Copyright (c) 2019 onwards the li[shogi in sca]la authors; AGPL-3.0-or-later, like the rest of this site.

export type EngineName = 'fairy' | 'yaneuraou';

export interface AiLevel {
  level: number;
  engine: EngineName;
  skill?: number;
  movetime: number;
  depth: number;
  book: boolean;
}

const table: [EngineName, number | undefined, number, number][] = [
  ['fairy', -9, 50, 5],
  ['fairy', -5, 100, 5],
  ['fairy', -1, 150, 5],
  ['fairy', 3, 200, 5],
  ['yaneuraou', undefined, 300, 2],
  ['yaneuraou', undefined, 400, 4],
  ['yaneuraou', undefined, 500, 8],
  ['yaneuraou', undefined, 1000, 13],
  ['yaneuraou', undefined, 1500, 17],
  ['yaneuraou', undefined, 2500, 22],
];

export const levels: AiLevel[] = table.map(([engine, skill, movetime, depth], i) => ({
  level: i + 1,
  engine,
  skill,
  movetime,
  depth,
  book: i + 1 <= 8,
}));

export const getLevel = (n: number): AiLevel => levels[Math.min(levels.length, Math.max(1, Math.round(n))) - 1];

export const engineLabel: Record<EngineName, string> = {
  fairy: 'Fairy-Stockfish',
  yaneuraou: 'YaneuraOu',
};
