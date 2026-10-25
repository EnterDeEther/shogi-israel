// Shogi Israel: the computer's ten levels, the same ladder as Lishogi's "play with the computer".
// Numbers copied from Lishogi's shoginet config (lila ui/@build/static/assets/shoginet/config.json, "move")
// and its engine choice (modules/game/src/main/EngineConfig.scala): levels 1-4 are Fairy-Stockfish held back
// by a negative Skill Level, levels 5-10 are YaneuraOu limited only by depth and time per move.
// Lishogi also plays from an opening book up to level 8 (modules/shoginet/src/main/Player.scala); see book.ts.
// Copyright (c) 2019 onwards the li[shogi in sca]la authors; AGPL-3.0-or-later, like the rest of this site.

export type EngineName = 'fairy' | 'yaneuraou';

export interface AiLevel {
  level: number;
  engine: EngineName;
  skill?: number; // Fairy-Stockfish Skill Level (-20..20); YaneuraOu runs at full skill
  movetime: number; // ms per move
  depth: number; // plies
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
