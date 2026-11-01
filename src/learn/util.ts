// Ported from Lishogi (lila) ui/learn/src/util.ts
// Source: https://github.com/WandererXII/lila/blob/89aea5f6f24c5e941c7cac8434a6e9e1acc15e94/ui/learn/src/util.ts
// Copyright (c) 2019 onwards the li[shogi in sca]la authors.
// Licensed under the GNU Affero General Public License v3.0 or later. See LICENSE.
// Modified by Shogi Israel (shogi.co.il), 2026-10-24.

import { forsythToPiece, parseSfen } from 'shogiops/sfen';
import type { Piece } from 'shogiops/types';
import { opposite, parseSquareName, parseUsi } from 'shogiops/util';
import type { Position } from 'shogiops/variant/position';
import type { Level, Scenario, UsiWithColor } from './interfaces';

export function createScenario(usis: Usi[], color: Color = 'sente', switchColor = false): Scenario {
  return usis.map((usi, i) => {
    return {
      usi: usi,
      color: switchColor && i % 2 ? opposite(color) : color,
    };
  });
}

export function currentPosition(
  level: Level,
  usiCList: UsiWithColor[] = [],
  ignoreObstacles = false,
): Position {
  const shogi = parseSfen('standard', level.sfen, false).unwrap();
  const obstacles = level.obstacles;

  if (!ignoreObstacles && obstacles)
    for (const obstacle of obstacles) {
      shogi.board.set(parseSquareName(obstacle), { role: 'pawn', color: opposite(level.color) });
    }

  for (const uc of usiCList) {
    shogi.turn = uc.color;
    shogi.play(parseUsi(uc.usi)!);
  }
  return shogi;
}

export function toPiece(sfenPiece: string): Piece {
  return forsythToPiece('standard')(sfenPiece)!;
}

export function average(nums: number[]): number {
  const sum = nums.reduce((a, b) => a + b, 0);
  return sum / nums.length || 0;
}
