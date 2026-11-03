import { expect, test } from 'bun:test';
import { parseSfen } from 'shogiops/sfen';
import { parseUsi } from 'shogiops/util';
import { HERO_ART, HERO_SCENE } from '../src/lib/home-hero';

test('hero battle is legal shogi and the check marks match the rules', () => {
  const pos = parseSfen('standard', HERO_SCENE.sfen).unwrap();
  expect(pos.isCheck()).toBe(false);
  for (const [i, { usi, check }] of HERO_SCENE.moves.entries()) {
    const m = parseUsi(usi)!;
    expect(pos.isLegal(m), `${i}: ${usi}`).toBe(true);
    pos.play(m);
    expect(pos.isCheck(), `${i}: ${usi} check`).toBe(!!check);
  }
});

test('hero battle shows a drop, a promotion, a capture and a check in the still frame', () => {
  const usis = HERO_SCENE.moves.map((m) => m.usi);
  expect(usis.some((u) => u[1] === '*')).toBe(true);
  expect(usis.some((u) => u.endsWith('+'))).toBe(true);
  expect(HERO_SCENE.moves[HERO_SCENE.still - 1].check).toBe(true);
  expect(HERO_ART.flashes.filter((f) => f.on).length).toBe(1);
  expect(HERO_ART.pieces.some((p) => p.still.pr)).toBe(true);
});
