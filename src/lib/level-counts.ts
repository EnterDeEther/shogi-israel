// Levels per Learn stage (stage key → number of levels), kept here so pages can count progress and XP
// without loading the lesson engine. test/xp.test.ts checks it against src/learn/categories.ts.
export const LEVEL_COUNTS: Record<string, number> = {
  introduction: 3,
  king: 3, gold: 5, silver: 6, knight: 4, lance: 4, bishop: 5, rook: 5, pawn: 4,
  capture: 6, drop: 9, protection: 13, check1: 5, outOfCheck: 12, checkmate1: 16,
  value: 9,
  staticRook: 2, rangingRook: 3, fourthFileRook: 6, centralRook: 3, thirdFileRook: 3, yagura: 5, bishopExchange: 2,
  ishida: 3, quickIshida: 2, opposingRook: 3, doubleRangingRook: 3, sidePawn: 3, twistingRook: 3,
  rangingCastles: 4, staticCastles: 3,
  primitiveClimbingSilver: 3, climbingSilverVsRanging: 3, sittingSilver: 5, chainedSilver: 2, bishopClimbingSilver: 2,
  rapidSilver: 3, bishopSittingSilver: 3, spearingSparrow: 2, whatIf: 3,
};
