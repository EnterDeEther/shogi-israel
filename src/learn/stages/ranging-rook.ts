// Lishogi (lila) ui/learn. AGPL-3.0-or-later, like the rest of src/learn/.

import { i18n } from '../i18n';
import { scenarioFailure, scenarioSuccess } from '../assert';
import type { IncompleteLevel, IncompleteStage } from '../interfaces';
import { createLevel } from '../level';
import { createScenario } from '../util';

const start = 'lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1';
const line = (goal: string, usis: string[], why: string[]): IncompleteLevel => ({
  goal: i18n(goal),
  sfen: start,
  nbMoves: 3,
  success: scenarioSuccess,
  failure: scenarioFailure,
  scenario: createScenario(usis, 'sente', true),
  why: why.map((k) => i18n(k)),
});

const levels: IncompleteLevel[] = [
  line('learn:il_rangingFourth', ['7g7f', '3c3d', '6g6f', '8c8d', '2h6h'], ['learn:il_whyRR_open', 'learn:il_whyRR4_2', 'learn:il_whyRR4_3']),
  line('learn:il_rangingThird', ['7g7f', '3c3d', '7f7e', '8c8d', '2h7h'], ['learn:il_whyRR_open', 'learn:il_whyRR3_2', 'learn:il_whyRR3_3']),
  line('learn:il_rangingCentral', ['7g7f', '3c3d', '5g5f', '8c8d', '2h5h'], ['learn:il_whyRR_open', 'learn:il_whyRRC_2', 'learn:il_whyRRC_3']),
];

const stage: IncompleteStage = {
  key: 'rangingRook',
  title: i18n('learn:il_rangingRook'),
  subtitle: i18n('learn:il_rangingRookSub'),
  intro: i18n('learn:il_rangingRookIntro'),
  levels: levels.map((l, i) => createLevel(l, i)),
  complete: i18n('learn:il_rangingRookComplete'),
};
export default stage;
