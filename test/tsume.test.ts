import { describe, expect, test } from 'bun:test';
import { makeUsi, parseUsi } from 'shogiops/util';
import mate1 from '../src/tsume/data/mate1.json';
import mate3 from '../src/tsume/data/mate3.json';
import mate5 from '../src/tsume/data/mate5.json';
import mate7 from '../src/tsume/data/mate7.json';
import { checks, isMate, parseTsume, Solver } from '../src/tsume/solve';

const sets: [number, [string, string][]][] = [[1, mate1 as [string, string][]], [3, mate3 as [string, string][]], [5, mate5 as [string, string][]], [7, mate7 as [string, string][]]];
const SAMPLE: Record<number, number> = { 1: 1, 3: 3, 5: 40, 7: 100 };

describe('tsume collections', () => {
  for (const [n, puzzles] of sets) {
    test(`mate in ${n}: ${puzzles.length} puzzles replay to mate`, () => {
      expect(puzzles.length).toBeGreaterThan(100);
      const seen = new Set<string>();
      for (const [sfen, line] of puzzles) {
        expect(seen.has(sfen)).toBe(false);
        seen.add(sfen);
        const pos = parseTsume(sfen);
        expect(pos.validate(true).isOk).toBe(true);
        expect(pos.turn).toBe('sente');
        expect(pos.isCheck('gote')).toBe(false);
        const usis = line.split(' ');
        expect(usis.length).toBe(n);
        usis.forEach((usi, i) => {
          const md = parseUsi(usi);
          expect(md && pos.isLegal(md)).toBe(true);
          pos.play(md!);
          if (i % 2 === 0) expect(pos.isCheck()).toBe(true);
        });
        expect(isMate(pos)).toBe(true);
        expect(pos.hands.sente.count()).toBe(0);
      }
    });

    test(`mate in ${n}: a sample re-solves with one right move at every step of the line`, () => {
      puzzles.forEach(([sfen, line], i) => {
        if (i % SAMPLE[n]) return;
        const s = new Solver(2_000_000);
        const pos = parseTsume(sfen);
        expect(s.distance(pos, n)).toBe(n);
        const usis = line.split(' ');
        for (let k = 0; k < n - 1; k += 2) {
          const good = checks(pos).filter((c) => s.defend(c.next, n - k - 1) === n - k - 1).map((c) => makeUsi(c.md));
          expect(good).toEqual([usis[k]]);
          pos.play(parseUsi(usis[k])!);
          pos.play(parseUsi(usis[k + 1])!);
        }
      });
    }, 120_000);
  }
});
