// Ported from Lishogi (lila) ui/learn/src/stages/gold.ts
// Source: https://github.com/WandererXII/lila/blob/89aea5f6f24c5e941c7cac8434a6e9e1acc15e94/ui/learn/src/stages/gold.ts
// Copyright (c) 2019 onwards the li[shogi in sca]la authors.
// Licensed under the GNU Affero General Public License v3.0 or later. See LICENSE.
// Modified by Shogi Israel (shogi.co.il), 2026-10-24.

import { i18n } from '../i18n';
import { obstaclesCaptured } from '../assert';
import type { IncompleteLevel, IncompleteStage } from '../interfaces';
import { createLevel } from '../level';
import { arrow, initial, pieceMovesHighlihts } from '../shapes';
import { toPiece } from '../util';

const levels: IncompleteLevel[] = [
  {
    goal: i18n('il_b_gold1Goal'),
    recap: i18n('il_b_gold1Recap'),
    sfen: '9/9/9/9/9/4G4/9/9/9 b -',
    nbMoves: 2,
    success: obstaclesCaptured,
    obstacles: ['4d'],
    drawShapes: initial([arrow('5f', '5e'), arrow('5e', '4d')]),
  },
  {
    goal: i18n('il_b_gold2Goal'),
    recap: i18n('il_b_gold2Recap'),
    sfen: '9/9/9/9/1G7/9/9/9/9 b -',
    nbMoves: 4,
    success: obstaclesCaptured,
    obstacles: ['8g', '8f', '7g', '6f'],
  },
  {
    goal: i18n('il_b_gold3Goal'),
    recap: i18n('il_b_gold3Recap'),
    sfen: '9/9/9/9/9/9/9/9/3G5 b -',
    nbMoves: 8,
    success: obstaclesCaptured,
    obstacles: ['6h', '7g', '8f', '8e', '7d', '6c', '6d', '5d'],
  },
  {
    goal: i18n('learn:goldDoesntPromote'),
    recap: i18n('il_b_gold4Recap'),
    sfen: '9/9/9/6G2/9/9/9/9/9 b -',
    nbMoves: 2,
    success: obstaclesCaptured,
    obstacles: ['2c', '3b'],
  },
  {
    goal: i18n('learn:goldSummary'),
    recap: i18n('il_b_gold5Recap'),
    sfen: '9/9/9/9/9/4G4/9/9/9 b -',
    nbMoves: 2,
    success: obstaclesCaptured,
    obstacles: ['5d'],
    squareHighlights: initial(pieceMovesHighlihts(toPiece('G'), '5f')),
  },
];

const stage: IncompleteStage = {
  key: 'gold',
  title: i18n('learn:theGold'),
  subtitle: i18n('learn:itMovesInAnyDirectionExceptDiagonallyBack'),
  intro: i18n('learn:goldIntro'),
  levels: levels.map((l, i) => createLevel(l, i)),
  complete: i18n('learn:goldComplete'),
};
export default stage;
