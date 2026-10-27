// Ported from Lishogi (lila) ui/learn/src/stages/rook.ts
// Source: https://github.com/WandererXII/lila/blob/89aea5f6f24c5e941c7cac8434a6e9e1acc15e94/ui/learn/src/stages/rook.ts
// Copyright (c) 2019 onwards the li[shogi in sca]la authors.
// Licensed under the GNU Affero General Public License v3.0 or later. See LICENSE.
// Modified by Shogi Israel (shogi.co.il), 2026-10-24: i18n import points to our Hebrew shim; positions unchanged. 2026-10-27: a recap per level (level.recap) and beginner goals written so nothing is used before it is taught.

import { i18n } from '../i18n';
import { obstaclesCaptured } from '../assert';
import type { IncompleteLevel, IncompleteStage } from '../interfaces';
import { createLevel } from '../level';
import { arrow, initial, pieceMovesHighlihts } from '../shapes';
import { toPiece } from '../util';

const levels: IncompleteLevel[] = [
  {
    goal: i18n('learn:rookGoal'),
    recap: i18n('il_b_rook1Recap'),
    sfen: '9/9/9/9/9/9/9/4R4/9 b -',
    nbMoves: 1,
    success: obstaclesCaptured,
    obstacles: ['5d'],
    drawShapes: initial([arrow('5h', '5d')]),
  },
  {
    goal: i18n('learn:grabAllTheStarsRemember'),
    recap: i18n('il_b_rook2Recap'),
    sfen: '9/9/9/9/9/9/9/9/9 b R',
    nbMoves: 3,
    success: obstaclesCaptured,
    obstacles: ['7g', '3g'],
  },
  {
    goal: i18n('learn:rookPromotion'),
    recap: i18n('il_b_rook3Recap'),
    sfen: '9/7R1/9/9/9/9/9/9/9 b -',
    nbMoves: 4,
    success: obstaclesCaptured,
    obstacles: ['2h', '3i', '3b', '4c'],
  },
  {
    goal: i18n('learn:rookSummary'),
    recap: i18n('il_b_rook4Recap'),
    sfen: '9/9/9/9/4R4/9/9/9/9 b -',
    nbMoves: 1,
    success: obstaclesCaptured,
    obstacles: ['5i'],
    squareHighlights: initial(pieceMovesHighlihts(toPiece('R'), '5e')),
  },
  {
    goal: i18n('learn:dragonSummaryTwo'),
    recap: i18n('il_b_rook5Recap'),
    sfen: '9/9/9/9/4+R4/9/9/9/9 b -',
    nbMoves: 2,
    success: obstaclesCaptured,
    obstacles: ['5b', '6c'],
    squareHighlights: initial(pieceMovesHighlihts(toPiece('+R'), '5e')),
  },
];

const stage: IncompleteStage = {
  key: 'rook',
  title: i18n('learn:theRook'),
  subtitle: i18n('learn:itMovesInStraightLines'),
  intro: i18n('learn:rookIntro'),
  levels: levels.map((l, i) => createLevel(l, i)),
  complete: i18n('learn:rookComplete'),
};
export default stage;
