// Ported from Lishogi (lila) ui/learn/src/categories.ts
// Source: https://github.com/WandererXII/lila/blob/89aea5f6f24c5e941c7cac8434a6e9e1acc15e94/ui/learn/src/categories.ts
// Copyright (c) 2019 onwards the li[shogi in sca]la authors.
// Licensed under the GNU Affero General Public License v3.0 or later. See LICENSE.
// Modified by Shogi Israel (shogi.co.il), 2026-10-24: spike: only the silver stage is registered.

import { i18n } from './i18n';
import type { Category, IncompleteStage, Stage } from './interfaces';
// Spike: only silver is ported so far. Upstream imports, for when the other stages land:
// bishop, capture, check1, checkmate1, drop, gold, intro, king, knight, lance,
// out-of-check, pawn, protection, repetition, rook, setup, value.
import silver from './stages/silver';

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
    key: 'shogiPieces',
    name: i18n('learn:shogiPieces'),
    stages: [silver].map(createStage),
  },
];

export const stages: Stage[] = ([] as Stage[]).concat(...categories.map(c => c.stages));

export function nextStage(stageId: number): Stage | undefined {
  const index = stages.findIndex(s => s.id === stageId);
  return stages[index + 1];
}
