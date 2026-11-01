// Ported from Lishogi (lila) ui/learn/src/categories.ts
// Source: https://github.com/WandererXII/lila/blob/89aea5f6f24c5e941c7cac8434a6e9e1acc15e94/ui/learn/src/categories.ts
// Copyright (c) 2019 onwards the li[shogi in sca]la authors.
// Licensed under the GNU Affero General Public License v3.0 or later. See LICENSE.
// Modified by Shogi Israel (shogi.co.il), 2026-10-24.
// Modified by Shogi Israel (shogi.co.il), 2026-10-27.

import { i18n } from './i18n';
import { castleStage, openingStage, whatIfStage } from './opening';
import * as op from './stages/openings-he';
import type { Category, IncompleteStage, Stage } from './interfaces';
import bishop from './stages/bishop';
import capture from './stages/capture';
import check1 from './stages/check1';
import checkmate1 from './stages/checkmate1';
import drop from './stages/drop';
import gold from './stages/gold';
import intro from './stages/intro';
import king from './stages/king';
import knight from './stages/knight';
import lance from './stages/lance';
import outOfCheck from './stages/out-of-check';
import pawn from './stages/pawn';
import repetition from './stages/repetition';
import protection from './stages/protection';
import rangingRook from './stages/ranging-rook';
import rook from './stages/rook';
import setup from './stages/setup';
import silver from './stages/silver';
import staticRook from './stages/static-rook';
import value from './stages/value';

function addStageId(): (iStage: IncompleteStage) => Stage {
  let cnt = 0;
  return (iStage: IncompleteStage) => {
    const stage = iStage as Stage;
    stage.id = ++cnt;
    return stage;
  };
}
const createStage = addStageId();

export const categories: Category[] = [
  {
    key: 'theIntroduction',
    name: i18n('learn:theIntroduction'),
    level: 'beginner',
    stages: [intro].map(createStage),
  },
  {
    key: 'shogiPieces',
    name: i18n('learn:shogiPieces'),
    level: 'beginner',
    stages: [king, gold, silver, knight, lance, bishop, rook, pawn].map(createStage),
  },
  {
    key: 'fundamentals',
    name: i18n('learn:fundamentals'),
    level: 'beginner',
    stages: [capture, drop, protection, check1, outOfCheck, checkmate1].map(createStage),
  },
  {
    key: 'intermediate',
    name: i18n('learn:intermediate'),
    level: 'intermediate',
    stages: [setup, repetition].map(createStage),
  },
  {
    key: 'openings',
    name: i18n('learn:il_openings'),
    level: 'intermediate',
    stages: [
      staticRook,
      rangingRook,
      ...[
        op.fourthFileRook, op.centralRook, op.thirdFileRook, op.yagura, op.bishopExchange,
        op.ishida, op.quickIshida, op.opposingRook, op.doubleRangingRook, op.sidePawn, op.twistingRook,
      ].map(openingStage),
    ].map(createStage),
  },
  {
    key: 'castles',
    name: i18n('learn:il_castlesCategory'),
    level: 'intermediate',
    stages: [op.rangingCastles, op.staticCastles].map(castleStage).map(createStage),
  },
  {
    key: 'advanced',
    name: i18n('learn:advanced'),
    level: 'advanced',
    stages: [value].map(createStage),
  },
  {
    key: 'strategy',
    name: i18n('learn:il_strategy'),
    level: 'advanced',
    stages: [
      op.primitiveClimbingSilver, op.climbingSilverVsRanging, op.sittingSilver, op.chainedSilver,
      op.bishopClimbingSilver, op.rapidSilver, op.bishopSittingSilver, op.spearingSparrow,
    ].map(openingStage).concat(whatIfStage(op.whatIf)).map(createStage),
  },
];

export const stages: Stage[] = ([] as Stage[]).concat(...categories.map(c => c.stages));

export function nextStage(stageId: number): Stage | undefined {
  const index = stages.findIndex(s => s.id === stageId);
  return stages[index + 1];
}
