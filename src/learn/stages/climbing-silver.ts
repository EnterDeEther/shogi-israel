// Shogi Israel (shogi.co.il), 2026-10-24: our own stage, written in the format of the stages ported from
// Lishogi (lila) ui/learn. AGPL-3.0-or-later, like the rest of src/learn/.
// Primitive Climbing Silver (genshi bōgin), Shogi Shack's first beginner plan; name from the glossary
// (strategy.primitive_climbing_silver). Positions follow on from the static rook stage.

import { i18n } from '../i18n';
import { scenarioFailure, scenarioSuccess } from '../assert';
import type { IncompleteLevel, IncompleteStage } from '../interfaces';
import { createLevel } from '../level';
import { createScenario } from '../util';

const levels: IncompleteLevel[] = [
  {
    goal: i18n('learn:il_climbingSilverUp'),
    sfen: 'lnsgk1snl/1r4gb1/p1ppppppp/9/9/9/PPPPPPP1P/1BG4R1/LNS1KGSNL b Pp 1',
    nbMoves: 4,
    success: scenarioSuccess,
    failure: scenarioFailure,
    scenario: createScenario(['3i3h', '7a6b', '3h2g', '5a4a', '2g2f', '6a5b', '2f3e', '5c5d'], 'sente', true),
    why: [i18n('learn:il_whyCS1_1'), i18n('learn:il_whyCS1_2'), i18n('learn:il_whyCS1_3'), i18n('learn:il_whyCS1_4')],
  },
  {
    goal: i18n('learn:il_climbingSilverBreak'),
    sfen: 'ln3ksnl/1r1sg1gb1/p1pp1pppp/4p4/6S2/9/PPPPPPP1P/1BG4R1/LNS1KG1NL b Pp 1',
    nbMoves: 4,
    success: scenarioSuccess,
    failure: scenarioFailure,
    scenario: createScenario(['P*2d', '2c2d', '3e2d', '3c3d', '2d2c', '2b4d', '2c3d+'], 'sente', true),
    why: [i18n('learn:il_whyCS2_1'), i18n('learn:il_whyCS2_2'), i18n('learn:il_whyCS2_3'), i18n('learn:il_whyCS2_4')],
    nextButton: true,
  },
];

const stage: IncompleteStage = {
  key: 'climbingSilver',
  title: i18n('learn:il_climbingSilver'),
  subtitle: i18n('learn:il_climbingSilverSub'),
  intro: i18n('learn:il_climbingSilverIntro'),
  levels: levels.map((l, i) => createLevel(l, i)),
  complete: i18n('learn:il_climbingSilverComplete'),
};
export default stage;
