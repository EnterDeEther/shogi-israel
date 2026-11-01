// AGPL-3.0-or-later.
import { describe, expect, test } from 'bun:test';
import { parseSfen } from 'shogiops/sfen';
import { impasse } from '../src/learn/impasse';

const pos = (sfen: string) => parseSfen('standard', sfen, false).unwrap();

const SENTE_28 = '+R+BGGSS3/PPPPK4/9/9/9/9/9/9/4k4 b 4N4L2P2g2s12p 1';
const SENTE_27 = '+R+BGGSS3/PPPPK4/9/9/9/9/9/9/4k4 b 4N4L1P2g2s13p 1';
const GOTE_27 = '4K4/9/9/9/9/9/9/4kpppp/3ssgg+b+r w 2G2S13P4n4l1p 1';
const SENTE_IN_CHECK = '+R+BGGSgS2/PPPPK4/9/9/9/9/9/9/4k4 b 4N4L2P1g2s12p 1';
const SENTE_9_PIECES = '+R+BGGSS3/PPP1K4/9/9/9/9/9/9/4k4 b 4N4L3P2g2s12p 1';
const KING_OUTSIDE = '+R+BGGSS3/PPPP5/9/4K4/9/9/9/9/4k4 b 4N4L2P2g2s12p 1';

describe('shogiops itself', () => {
  test('outcome() does not end the game in a winning impasse position', () => {
    const p = pos(SENTE_28);
    expect(p.outcome()).toBeUndefined();
    expect(p.isEnd()).toBe(false);
  });
});

describe('our 27-point checker', () => {
  test('sente with 28 points, 10 pieces, king in, no check: can declare', () => {
    expect(impasse(pos(SENTE_28))).toEqual({ kingInZone: true, notInCheck: true, piecesInZone: 10, points: 28, needed: 28, canDeclare: true });
  });
  test('sente with 27 points: cannot (sente needs 28)', () => {
    const r = impasse(pos(SENTE_27));
    expect(r.points).toBe(27);
    expect(r.canDeclare).toBe(false);
  });
  test('gote with 27 points: can declare', () => {
    expect(impasse(pos(GOTE_27))).toEqual({ kingInZone: true, notInCheck: true, piecesInZone: 10, points: 27, needed: 27, canDeclare: true });
  });
  test('in check: cannot', () => {
    const r = impasse(pos(SENTE_IN_CHECK));
    expect(r.notInCheck).toBe(false);
    expect(r.canDeclare).toBe(false);
  });
  test('only 9 pieces in the zone: cannot, even with 28 points', () => {
    const r = impasse(pos(SENTE_9_PIECES));
    expect([r.piecesInZone, r.points, r.canDeclare]).toEqual([9, 28, false]);
  });
  test('king outside the zone: cannot', () => {
    const r = impasse(pos(KING_OUTSIDE));
    expect([r.kingInZone, r.canDeclare]).toEqual([false, false]);
  });
  test('the opponent is checked separately (the side not to move)', () => {
    expect(impasse(pos(SENTE_28), 'gote').canDeclare).toBe(false);
  });
});
