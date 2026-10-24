// Shogi Israel (shogi.co.il), 2026-10-24: our own stage, written in the format of the stages ported from
// Lishogi (lila) ui/learn. AGPL-3.0-or-later, like the rest of src/learn/.
// Moves follow the beginner lines in Shogi Shack's openings pages; names follow the glossary (opening.static_rook).

import { i18n } from '../i18n';
import { scenarioFailure, scenarioSuccess } from '../assert';
import type { IncompleteLevel, IncompleteStage } from '../interfaces';
import { createLevel } from '../level';
import { createScenario } from '../util';

const levels: IncompleteLevel[] = [
  {
    goal: i18n('learn:il_staticRookPush'),
    sfen: 'lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1',
    nbMoves: 3,
    success: scenarioSuccess,
    failure: scenarioFailure,
    scenario: createScenario(['2g2f', '8c8d', '2f2e', '8d8e', '6i7h', '4a3b'], 'sente', true),
    why: [i18n('learn:il_whySR1_1'), i18n('learn:il_whySR1_2'), i18n('learn:il_whySR1_3')],
  },
  {
    goal: i18n('learn:il_staticRookExchange'),
    sfen: 'lnsgk1snl/1r4gb1/p1ppppppp/9/1p5P1/9/PPPPPPP1P/1BG4R1/LNS1KGSNL b - 7',
    nbMoves: 3,
    success: scenarioSuccess,
    failure: scenarioFailure,
    scenario: createScenario(['2e2d', '2c2d', '2h2d', 'P*2c', '2d2h'], 'sente', true),
    why: [i18n('learn:il_whySR2_1'), i18n('learn:il_whySR2_2'), i18n('learn:il_whySR2_3')],
  },
];

const stage: IncompleteStage = {
  key: 'staticRook',
  title: i18n('learn:il_staticRook'),
  subtitle: i18n('learn:il_staticRookSub'),
  intro: i18n('learn:il_staticRookIntro'),
  levels: levels.map((l, i) => createLevel(l, i)),
  complete: i18n('learn:il_staticRookComplete'),
};
export default stage;
