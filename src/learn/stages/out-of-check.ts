// Ported from Lishogi (lila) ui/learn/src/stages/out-of-check.ts
// Source: https://github.com/WandererXII/lila/blob/89aea5f6f24c5e941c7cac8434a6e9e1acc15e94/ui/learn/src/stages/out-of-check.ts
// Copyright (c) 2019 onwards the li[shogi in sca]la authors.
// Licensed under the GNU Affero General Public License v3.0 or later. See LICENSE.
// Modified by Shogi Israel (shogi.co.il), 2026-10-24: i18n import points to our Hebrew shim; positions unchanged. 2026-10-27: a recap per level (level.recap) and beginner goals written so nothing is used before it is taught.

import { i18n } from '../i18n';
import { and, check, colorOn, not, pieceOn, unprotectedCapture } from '../assert';
import type { IncompleteLevel, IncompleteStage } from '../interfaces';
import { createLevel } from '../level';
import { arrow, checkShapes, circle, concat, initial, onUsi } from '../shapes';
import { toPiece } from '../util';

const levels: IncompleteLevel[] = [
  {
    goal: i18n('learn:ifYourKingIsAttacked'),
    recap: i18n('il_b_outRecap1'),
    sfen: '9/9/9/9/4r4/9/9/9/4K4 b - 1',
    nbMoves: 1,
    success: not(check('sente')),
    failure: () => true,
    drawShapes: concat(initial([arrow('5e', '5i', 'red')]), checkShapes),
    offerIllegalDests: true,
  },
  {
    goal: i18n('learn:escapeWithTheKing'),
    recap: i18n('il_b_outRecapEscape'),
    sfen: '9/9/9/9/9/9/9/2s1r4/3K5 b - 1',
    nbMoves: 1,
    success: not(check('sente')),
    failure: () => true,
    drawShapes: checkShapes,
    offerIllegalDests: true,
  },
  {
    goal: i18n('learn:theKingCannotEscapeButBlock'),
    recap: i18n('il_b_outRecapBlock'),
    sfen: '9/9/9/9/9/9/6PPP/4+r2K1/6SNL b - 1',
    nbMoves: 1,
    success: not(check('sente')),
    failure: () => true,
    drawShapes: checkShapes,
    offerIllegalDests: true,
  },
  {
    goal: i18n('learn:theKingCannotEscapeButBlock'),
    recap: i18n('il_b_outRecapBlock'),
    sfen: '9/9/9/9/9/9/6PPP/5+r1K1/7NL b G 1',
    nbMoves: 1,
    success: not(check('sente')),
    failure: () => true,
    drawShapes: checkShapes,
    offerIllegalDests: true,
  },
  {
    goal: i18n('learn:theKingCannotEscapeButBlock'),
    recap: i18n('il_b_outRecapBlock'),
    sfen: '9/9/9/9/5b3/9/6B1P/8K/6sNL b P 1',
    nbMoves: 1,
    success: not(check('sente')),
    failure: () => true,
    drawShapes: checkShapes,
    offerIllegalDests: true,
  },
  {
    goal: i18n('learn:youCanGetOutOfCheckByTaking'),
    recap: i18n('il_b_outRecapTake'),
    sfen: '9/9/9/9/9/9/6PPp/5+p1KP/5GbNL b - 1',
    nbMoves: 1,
    success: not(check('sente')),
    failure: () => true,
    drawShapes: checkShapes,
    offerIllegalDests: true,
  },
  {
    goal: i18n('learn:getOutOfCheck'),
    recap: i18n('il_b_outRecap'),
    sfen: '9/9/9/9/9/9/3Ss4/3s5/3K5 b - 1',
    nbMoves: 1,
    success: not(check('sente')),
    failure: () => true,
    drawShapes: checkShapes,
    offerIllegalDests: true,
  },
  {
    goal: i18n('learn:getOutOfCheck'),
    recap: i18n('il_b_outRecap'),
    sfen: '9/9/9/7p1/8b/4sPK2/6g2/9/9 b - 1',
    nbMoves: 1,
    success: not(check('sente')),
    failure: () => true,
    drawShapes: checkShapes,
    offerIllegalDests: true,
  },
  {
    goal: i18n('learn:getOutOfCheck'),
    recap: i18n('il_b_outRecap'),
    sfen: '9/9/9/6n2/6p2/5Ks2/9/4r4/9 b - 1',
    nbMoves: 1,
    success: not(check('sente')),
    failure: () => true,
    drawShapes: checkShapes,
    offerIllegalDests: true,
  },
  {
    goal: i18n('learn:getOutOfCheck'),
    recap: i18n('il_b_outRecap'),
    sfen: '9/9/9/9/8P/8l/7P1/6rSK/7NL b P 1',
    nbMoves: 1,
    success: and(not(check('sente')), not(pieceOn(toPiece('P'), '1g'))),
    failure: () => true,
    drawShapes: concat(checkShapes, onUsi('P*1g', [circle('1e', 'red'), circle('1g', 'red')])),
    offerIllegalDests: true,
  },
  {
    goal: i18n('learn:watchOutForYourOpponentsReply'),
    recap: i18n('il_b_outRecapReply'),
    sfen: '9/9/9/9/9/4b4/PPG6/LS7/K4r3 b L 1',
    nbMoves: 1,
    success: and(not(unprotectedCapture), not(check('sente'))),
    failure: () => true,
    drawShapes: checkShapes,
    offerIllegalDests: true,
    showFailureMove: 'unprotected',
  },
  {
    goal: i18n('learn:watchOutForYourOpponentsReply'),
    recap: i18n('il_b_outRecapReply'),
    sfen: '9/9/9/9/9/5+bn2/5GPPP/6SK1/5G1NL b g 1',
    nbMoves: 1,
    success: and(not(check('sente')), colorOn('sente', '3f')),
    failure: () => true,
    drawShapes: checkShapes,
    offerIllegalDests: true,
    showFailureMove: (_, usiCList) => {
      if (usiCList.length && usiCList[0].usi.startsWith('2h')) return 'G*2h';
      else return undefined;
    },
  },
];
const stage: IncompleteStage = {
  key: 'outOfCheck',
  title: i18n('learn:outOfCheck'),
  subtitle: i18n('learn:defendYourKing'),
  intro: i18n('learn:outOfCheckIntro'),
  levels: levels.map((l, i) => createLevel(l, i)),
  complete: i18n('learn:outOfCheckComplete'),
};

export default stage;
