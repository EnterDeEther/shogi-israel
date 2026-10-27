// Ported from Lishogi (lila) ui/learn/src/stages/knight.ts
// Source: https://github.com/WandererXII/lila/blob/89aea5f6f24c5e941c7cac8434a6e9e1acc15e94/ui/learn/src/stages/knight.ts
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
    goal: i18n('learn:knightsHaveAFancyWay'),
    recap: i18n('il_b_knight1Recap'),
    sfen: '9/9/9/9/9/9/9/9/1N7 b -',
    nbMoves: 2,
    success: obstaclesCaptured,
    obstacles: ['7g', '8e'],
    drawShapes: initial([arrow('8i', '7g'), arrow('7g', '8e')]),
  },
  {
    goal: i18n('learn:knightPromotion'),
    recap: i18n('il_b_knight2Recap'),
    sfen: '9/9/9/9/9/9/9/1N7/9 b -',
    nbMoves: 5,
    success: obstaclesCaptured,
    obstacles: ['7f', '8d', '7b', '6b', '6c'],
  },
  {
    goal: i18n('learn:knightSummary'),
    recap: i18n('il_b_knight3Recap'),
    sfen: '9/9/9/9/9/4N4/9/9/9 b -',
    nbMoves: 1,
    success: obstaclesCaptured,
    obstacles: ['4d'],
    squareHighlights: initial(pieceMovesHighlihts(toPiece('N'), '5f')),
  },
  {
    goal: i18n('learn:pknightSummary'),
    recap: i18n('il_b_knight4Recap'),
    sfen: '9/9/9/9/9/4+N4/9/9/9 b -',
    nbMoves: 2,
    success: obstaclesCaptured,
    obstacles: ['5d'],
    squareHighlights: initial(pieceMovesHighlihts(toPiece('+N'), '5f')),
  },
];

const stage: IncompleteStage = {
  key: 'knight',
  title: i18n('learn:theKnight'),
  subtitle: i18n('learn:itMovesInAnLShape'),
  intro: i18n('learn:knightIntro'),
  levels: levels.map((l, i) => createLevel(l, i)),
  complete: i18n('learn:knightComplete'),
};

export default stage;
