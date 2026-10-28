// Ported from Lishogi (lila) ui/learn/src/level.ts
// Source: https://github.com/WandererXII/lila/blob/89aea5f6f24c5e941c7cac8434a6e9e1acc15e94/ui/learn/src/level.ts
// Copyright (c) 2019 onwards the li[shogi in sca]la authors.
// Licensed under the GNU Affero General Public License v3.0 or later. See LICENSE.
// Modified by Shogi Israel (shogi.co.il), 2026-10-24: unchanged.

import type { IncompleteLevel, Level, Score, UsiWithColor } from './interfaces';

export function createLevel(l: IncompleteLevel, it: number): Level {
  return {
    id: it + 1,
    color: l.sfen.includes(' b') ? 'sente' : 'gote',
    ...l,
  };
}

// assumes level is completed
/** Shogi Israel: the player's own moves in this level (the opponent's replies don't count). */
export const ownMoves = (l: Level, usiCList: UsiWithColor[]): number => usiCList.filter(uc => uc.color === l.color).length;

export function calcScore(l: Level, usiCList: UsiWithColor[]): Score {
  const nbMoves = ownMoves(l, usiCList);
  if (nbMoves <= l.nbMoves) return 3;
  else if (nbMoves - 1 <= l.nbMoves) return 2;
  else return 1;
}
