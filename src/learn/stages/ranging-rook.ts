// Shogi Israel (shogi.co.il), 2026-10-24: our own stage, written in the format of the stages ported from
// Lishogi (lila) ui/learn. AGPL-3.0-or-later, like the rest of src/learn/.
// Fourth-file, third-file and central rook; names follow the glossary (opening.fourth_file, third_file, central).

import { i18n } from '../i18n';
import { scenarioFailure, scenarioSuccess } from '../assert';
import type { IncompleteLevel, IncompleteStage } from '../interfaces';
import { createLevel } from '../level';
import { createScenario } from '../util';

const start = 'lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1';
const line = (goal: string, usis: string[]): IncompleteLevel => ({
  goal: i18n(goal),
  sfen: start,
  nbMoves: 3,
  success: scenarioSuccess,
  failure: scenarioFailure,
  scenario: createScenario(usis, 'sente', true),
});

const levels: IncompleteLevel[] = [
  line('learn:il_rangingFourth', ['7g7f', '3c3d', '6g6f', '8c8d', '2h6h']),
  line('learn:il_rangingThird', ['7g7f', '3c3d', '7f7e', '8c8d', '2h7h']),
  line('learn:il_rangingCentral', ['7g7f', '3c3d', '5g5f', '8c8d', '2h5h']),
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
