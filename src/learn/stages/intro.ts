// Ported from Lishogi (lila) ui/learn/src/stages/intro.ts
// Source: https://github.com/WandererXII/lila/blob/89aea5f6f24c5e941c7cac8434a6e9e1acc15e94/ui/learn/src/stages/intro.ts
// Copyright (c) 2019 onwards the li[shogi in sca]la authors.
// Licensed under the GNU Affero General Public License v3.0 or later. See LICENSE.
// Modified by Shogi Israel (shogi.co.il), 2026-10-24: i18n import points to our Hebrew shim; positions unchanged. 2026-10-27: a recap per level (level.recap) and beginner goals written so nothing is used before it is taught.

import { i18n } from '../i18n';
import type { SquareHighlight } from 'shogiground/draw';
import type { IncompleteLevel, IncompleteStage } from '../interfaces';
import { createLevel } from '../level';
import { arrow, initial } from '../shapes';

const levels: IncompleteLevel[] = [
  {
    goal: i18n('learn:choosePieceDesign'),
    recap: i18n('il_b_intro1Recap'),
    sfen: '9/9/9/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b -',
    nbMoves: 1,
    success: () => true,
    text: i18n('learn:clickHereAfterYouveChosen'),
  },
  {
    goal: i18n('learn:promotionZone'),
    recap: i18n('il_b_intro2Recap'),
    sfen: '9/9/9/4P4/9/9/9/9/9 b -',
    nbMoves: 1,
    success: () => true,
    drawShapes: initial([arrow('5d', '5c')]),
    squareHighlights: () =>
      [
        '9a',
        '8a',
        '7a',
        '6a',
        '5a',
        '4a',
        '3a',
        '2a',
        '1a',
        '9b',
        '8b',
        '7b',
        '6b',
        '5b',
        '4b',
        '3b',
        '2b',
        '1b',
        '9c',
        '8c',
        '7c',
        '6c',
        '5c',
        '4c',
        '3c',
        '2c',
        '1c',
      ].map(sq => {
        return { key: sq, className: 'help' } as SquareHighlight;
      }),
  },
  {
    goal: i18n('learn:senteGoesFirst'),
    recap: i18n('il_b_intro3Recap'),
    sfen: '9/9/9/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b -',
    nbMoves: 1,
    success: () => true,
  },
];

const stage: IncompleteStage = {
  key: 'introduction',
  title: i18n('learn:theIntroduction'),
  subtitle: i18n('learn:introBasics'),
  intro: i18n('learn:introIntro'),
  levels: levels.map((l, i) => createLevel(l, i)),
  complete: i18n('learn:introCompleteTwo'),
};
export default stage;
