// Ported from Lishogi (lila) ui/learn/src/categories.ts
// Source: https://github.com/WandererXII/lila/blob/89aea5f6f24c5e941c7cac8434a6e9e1acc15e94/ui/learn/src/categories.ts
// Copyright (c) 2019 onwards the li[shogi in sca]la authors.
// Licensed under the GNU Affero General Public License v3.0 or later. See LICENSE.
// Modified by Shogi Israel (shogi.co.il), 2026-10-24: i18n import points to our Hebrew shim; lila's stages in lila's order, without setup and repetition (Intermediate), which Dean removed on 2026-10-24; our own openings, castles and strategy categories added after lila's.

import { i18n } from './i18n';
import type { Category, IncompleteStage, Stage } from './interfaces';
import bishop from './stages/bishop';
import capture from './stages/capture';
import castles from './stages/castles';
import check1 from './stages/check1';
import checkmate1 from './stages/checkmate1';
import climbingSilver from './stages/climbing-silver';
import drop from './stages/drop';
import gold from './stages/gold';
import intro from './stages/intro';
import king from './stages/king';
import knight from './stages/knight';
import lance from './stages/lance';
import outOfCheck from './stages/out-of-check';
import pawn from './stages/pawn';
import protection from './stages/protection';
import rangingRook from './stages/ranging-rook';
import rook from './stages/rook';
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
    stages: [intro].map(createStage),
  },
  {
    key: 'shogiPieces',
    name: i18n('learn:shogiPieces'),
    stages: [king, gold, silver, knight, lance, bishop, rook, pawn].map(createStage),
  },
  {
    key: 'fundamentals',
    name: i18n('learn:fundamentals'),
    stages: [capture, drop, protection, check1, outOfCheck, checkmate1].map(createStage),
  },
  {
    key: 'advanced',
    name: i18n('learn:advanced'),
    stages: [value].map(createStage),
  },
  // Shogi Israel's own stages (Dean, 2026-10-24: openings, castles and strategy)
  {
    key: 'openings',
    name: i18n('learn:il_openings'),
    stages: [staticRook, rangingRook].map(createStage),
  },
  {
    key: 'castles',
    name: i18n('learn:il_castlesCategory'),
    stages: [castles].map(createStage),
  },
  {
    key: 'strategy',
    name: i18n('learn:il_strategy'),
    stages: [climbingSilver].map(createStage),
  },
];

export const stages: Stage[] = ([] as Stage[]).concat(...categories.map(c => c.stages));

export function nextStage(stageId: number): Stage | undefined {
  const index = stages.findIndex(s => s.id === stageId);
  return stages[index + 1];
}
