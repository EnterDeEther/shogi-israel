// Shogi Israel (shogi.co.il), 2026-10-24: our own stage, written in the format of the stages ported from
// Lishogi (lila) ui/learn. AGPL-3.0-or-later, like the rest of src/learn/.
// The opponent waits while the user builds; the circles mark where each piece of the castle goes.
// Names follow the glossary (castle.mino, castle.boat, castle.yagura).

import { i18n } from '../i18n';
import { and, pieceOn } from '../assert';
import type { IncompleteLevel, IncompleteStage } from '../interfaces';
import { createLevel } from '../level';
import { circle } from '../shapes';
import { toPiece } from '../util';

const castle = (goal: string, sfen: string, nbMoves: number, pieces: [string, Key][]): IncompleteLevel => ({
  goal: i18n(goal),
  sfen,
  nbMoves,
  success: and(...pieces.map(([p, k]) => pieceOn(toPiece(p), k))),
  drawShapes: () => pieces.map(([, k]) => circle(k)),
});

const levels: IncompleteLevel[] = [
  // rook already on 68 (fourth-file ranging rook)
  castle('learn:il_castleMino', 'lnsgkgsnl/1r5b1/ppppppppp/9/9/2PP5/PP2PPPPP/1B1R5/LNSGKGSNL b - 1', 5, [
    ['K', '2h'], ['S', '3h'], ['G', '4i'], ['G', '5h'],
  ]),
  castle('learn:il_castleBoat', 'lnsgkgsnl/1r5b1/ppppppppp/9/7P1/2P6/PP1PPPP1P/1B5R1/LNSGKGSNL b - 1', 3, [
    ['K', '7h'], ['G', '6i'], ['G', '5h'],
  ]),
  castle('learn:il_castleYagura', 'lnsgkgsnl/1r5b1/ppppppppp/9/9/2PP5/PP2PPPPP/1B5R1/LNSGKGSNL b - 1', 5, [
    ['S', '7g'], ['G', '7h'], ['G', '6g'],
  ]),
  castle('learn:il_castleYaguraKing', 'lnsgkgsnl/1r5b1/ppppppppp/9/9/2PP5/PPSGPPPPP/1BG4R1/LN2K1SNL b - 1', 5, [
    ['K', '8h'], ['B', '6h'],
  ]),
];

const stage: IncompleteStage = {
  key: 'castles',
  title: i18n('learn:il_castles'),
  subtitle: i18n('learn:il_castlesSub'),
  intro: i18n('learn:il_castlesIntro'),
  levels: levels.map((l, i) => createLevel(l, i)),
  complete: i18n('learn:il_castlesComplete'),
};
export default stage;
