// Ported from Lishogi (lila) ui/learn/src/stages/king.ts
// Source: https://github.com/WandererXII/lila/blob/89aea5f6f24c5e941c7cac8434a6e9e1acc15e94/ui/learn/src/stages/king.ts
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
    goal: i18n('learn:theKingIsSlow'),
    recap: i18n('il_b_king1Recap'),
    sfen: '9/9/9/9/9/9/3K5/9/9 b -',
    nbMoves: 3,
    success: obstaclesCaptured,
    drawShapes: initial([arrow('6g', '6f'), arrow('6f', '6e'), arrow('6e', '5d')]),
    obstacles: ['5d'],
  },
  {
    goal: i18n('il_b_king2Goal'),
    recap: i18n('il_b_king2Recap'),
    sfen: '9/9/9/5K3/9/9/9/9/9 b -',
    nbMoves: 4,
    success: obstaclesCaptured,
    obstacles: ['6c', '5b', '4c', '4b'],
  },
  {
    goal: i18n('learn:kingSummary'),
    recap: i18n('il_b_king3Recap'),
    sfen: '9/9/9/9/4K4/9/9/9/9 b -',
    nbMoves: 2,
    success: obstaclesCaptured,
    obstacles: ['5c'],
    squareHighlights: initial(pieceMovesHighlihts(toPiece('K'), '5e')),
  },
];

const stage: IncompleteStage = {
  key: 'king',
  title: i18n('learn:theKing'),
  subtitle: i18n('learn:theMostImportantPiece'),
  intro: i18n('learn:kingIntro'),
  levels: levels.map((l, i) => createLevel(l, i)),
  complete: i18n('learn:kingComplete'),
};
export default stage;
