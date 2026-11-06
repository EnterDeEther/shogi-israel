import { describe, expect, test } from 'bun:test';
import { initialSfen, makeSfen, parseSfen } from 'shogiops/sfen';
import { makeUsi, parseUsi } from 'shogiops/util';
import type { Position } from 'shogiops/variant/position';
import { Pos, moveToUsi, think, usiToMove } from '../src/play/lite';

const START = initialSfen('standard');
const parse = (sfen: string) => parseSfen('standard', sfen, false).unwrap();

function opsLegal(pos: Position): Set<string> {
  const out = new Set<string>();
  for (const [from, dests] of pos.allMoveDests()) {
    for (const to of dests) {
      for (const promotion of [false, true]) {
        const md = { from, to, promotion };
        if (pos.isLegal(md)) out.add(makeUsi(md));
      }
    }
  }
  for (const [name, dests] of pos.allDropDests()) {
    const role = name.split(' ')[1] as never;
    for (const to of dests) out.add(makeUsi({ role, to }));
  }
  return out;
}

function seeded(n: number) {
  let s = n >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

describe('lite engine rules', () => {
  test('legal moves match the site rules over random games', () => {
    const random = seeded(7);
    let positions = 0;
    for (let game = 0; game < 24; game++) {
      const ops = parse(START);
      const lite = Pos.fromSfen(START);
      for (let ply = 0; ply < 160; ply++) {
        const want = opsLegal(ops);
        const got = new Set(lite.legalMoves(true).map(moveToUsi));
        if (want.size !== got.size || [...want].some((u) => !got.has(u))) {
          const missing = [...want].filter((u) => !got.has(u));
          const extra = [...got].filter((u) => !want.has(u));
          throw new Error(`${makeSfen(ops)} missing ${missing.join(',')} extra ${extra.join(',')}`);
        }
        positions++;
        if (!want.size) break;
        const list = [...want];
        const captures = list.filter((u) => !u.includes('*') && ops.board.has(parseUsi(u)!.to));
        const usi = captures.length && random() < 0.6 ? captures[Math.floor(random() * captures.length)] : list[Math.floor(random() * list.length)];
        ops.play(parseUsi(usi)!);
        lite.make(usiToMove(usi));
      }
    }
    expect(positions).toBeGreaterThan(2000);
  }, 60000);

  test('pawn drop mate is not allowed, but a pawn drop check is', () => {
    const mate = Pos.fromSfen('4k4/9/3GPG3/9/9/9/9/9/4K4 b P 1');
    expect(mate.legalMoves().map(moveToUsi)).not.toContain('P*5b');
    const check = Pos.fromSfen('4k4/9/3G1G3/9/9/9/9/9/4K4 b P 1');
    expect(check.legalMoves().map(moveToUsi)).toContain('P*5b');
  });

  test('no second pawn on a file and no dead drops', () => {
    const pos = Pos.fromSfen('4k4/9/9/9/9/9/4P4/9/4K4 b PLN 1');
    const usis = pos.legalMoves().map(moveToUsi);
    expect(usis.some((u) => u.startsWith('P*5'))).toBe(false);
    expect(usis).not.toContain('P*4a');
    expect(usis).not.toContain('L*4a');
    expect(usis).not.toContain('N*4b');
    expect(usis).toContain('N*4c');
  });
});

describe('lite engine play', () => {
  const clock = () => {
    let t = 0;
    return () => (t += 0.001);
  };

  test('takes a free rook from level 2 up', () => {
    const sfen = '4k4/9/9/9/4r4/9/9/4R4/4K4 b - 1';
    for (const level of [2, 3, 4]) expect(think(sfen, [], level, seeded(level), clock())).toBe('5h5e');
  });

  test('mates in one at levels 3 and 4', () => {
    const sfen = '4k4/9/4P4/9/9/9/9/9/4K4 b G 1';
    for (const level of [3, 4]) expect(think(sfen, [], level, seeded(level), clock())).toBe('G*5b');
  });

  test('every reply is legal for the site rules', () => {
    const random = seeded(11);
    for (let level = 1; level <= 4; level++) {
      const ops = parse(START);
      const moves: string[] = [];
      for (let ply = 0; ply < 40 && !ops.isEnd(); ply++) {
        let usi: string;
        if (ply % 2 === 0) {
          const list = [...opsLegal(ops)];
          usi = list[Math.floor(random() * list.length)];
        } else {
          usi = think(START, moves, level, random, clock());
        }
        const md = parseUsi(usi);
        expect(md && ops.isLegal(md)).toBe(true);
        ops.play(md!);
        moves.push(usi);
      }
    }
  });

  test('a position with one legal move answers at once', () => {
    expect(think('8k/9/9/9/9/9/9/7r1/8K b - 1', [], 4)).toBe('1i2h');
  });
});
