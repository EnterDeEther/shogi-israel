// Ported from Lishogi (lila) ui/learn/src/stages/pawn.ts
// Source: https://github.com/WandererXII/lila/blob/89aea5f6f24c5e941c7cac8434a6e9e1acc15e94/ui/learn/src/stages/pawn.ts
// Copyright (c) 2019 onwards the li[shogi in sca]la authors.
// Licensed under the GNU Affero General Public License v3.0 or later. See LICENSE.
// Modified by Shogi Israel (shogi.co.il), 2026-10-24: i18n import points to our Hebrew shim; positions, goals and key names unchanged.

import { i18n } from '../i18n';
import { obstaclesCaptured } from '../assert';
import type { IncompleteLevel, IncompleteStage } from '../interfaces';
import { createLevel } from '../level';
import { arrow, initial, pieceMovesHighlihts } from '../shapes';
import { toPiece } from '../util';

const levels: IncompleteLevel[] = [
  {
    goal: i18n('learn:pawnsMoveOneSquareOnly'),
    sfen: '9/9/9/9/9/9/2P6/9/9 b -',
    nbMoves: 3,
    success: obstaclesCaptured,
    obstacles: ['7d'],
    drawShapes: initial([arrow('7g', '7f'), arrow('7f', '7e'), arrow('7e', '7d')]),
  },
  {
    goal: i18n('learn:pawnPromotion'),
    sfen: '9/9/9/9/9/9/6P2/9/9 b -',
    nbMoves: 5,
    success: obstaclesCaptured,
    obstacles: ['2c'],
  },
  {
    goal: i18n('learn:pawnSummary'),
    sfen: '9/9/9/9/9/4P4/9/9/9 b -',
    nbMoves: 2,
    success: obstaclesCaptured,
    obstacles: ['5d'],
    squareHighlights: initial(pieceMovesHighlihts(toPiece('P'), '5f')),
  },
  {
    goal: i18n('learn:tokinSummary'),
    sfen: '9/9/9/9/9/4+P4/9/9/9 b -',
    nbMoves: 2,
    success: obstaclesCaptured,
    obstacles: ['5d'],
    squareHighlights: initial(pieceMovesHighlihts(toPiece('+P'), '5f')),
  },
];

const stage: IncompleteStage = {
  key: 'pawn',
  title: i18n('learn:thePawn'),
  subtitle: i18n('learn:itMovesForwardOnly'),
  intro: i18n('learn:pawnIntro'),
  levels: levels.map((l, i) => createLevel(l, i)),
  complete: i18n('learn:pawnComplete'),
};

export default stage;
