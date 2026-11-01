import { beforeEach, describe, expect, test } from 'bun:test';
import { stages } from '../src/learn/categories';
import he from '../src/learn/i18n/he.json';
import { chessNote, isChessRoute, ROUTE_KEY, routeFromUrl, stageText } from '../src/learn/route';

const strings = he as Record<string, string>;
const chessKeys = Object.keys(strings).filter((k) => k.startsWith('il_chess_'));
const COMING_BACK = ['setup', 'repetition'];
const BEGINNER = ['introduction', 'king', 'gold', 'silver', 'knight', 'lance', 'bishop', 'rook', 'pawn',
  'capture', 'drop', 'protection', 'check1', 'outOfCheck', 'checkmate1', ...COMING_BACK];

const mem = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
  key: (i: number) => [...mem.keys()][i] ?? null,
  get length() { return mem.size; },
};

describe('chess-player strings', () => {
  test('each one names a stage that exists', () => {
    const keys = new Set([...stages.map((s) => s.key), ...COMING_BACK]);
    for (const k of chessKeys) {
      const m = k.match(/^il_chess_(\w+?)(Intro|Complete|Note)$/);
      expect(m, k).not.toBeNull();
      expect(keys.has(m![1]), k).toBe(true);
    }
  });
  test('every beginner stage has a chess intro and recap', () => {
    for (const s of BEGINNER) {
      expect(strings[`il_chess_${s}Intro`], s).toBeTruthy();
      expect(strings[`il_chess_${s}Complete`], s).toBeTruthy();
    }
  });
  test('openings, castles and piece value have a chess note', () => {
    const noted = ['value', 'staticRook', 'rangingRook', 'fourthFileRook', 'centralRook', 'thirdFileRook', 'yagura',
      'bishopExchange', 'ishida', 'quickIshida', 'opposingRook', 'doubleRangingRook', 'sidePawn', 'twistingRook',
      'whatIf', 'rangingCastles', 'staticCastles'];
    for (const k of noted) expect(strings[`il_chess_${k}Note`], k).toBeTruthy();
  });
  test('no plural address and well-formed gender tokens', () => {
    for (const k of chessKeys) {
      const t = strings[k];
      expect(t.replace(/⟦[^⟦⟧|]+\|[^⟦⟧|]+⟧/g, ''), k).not.toMatch(/[⟦⟧]/);
      expect(t, k).not.toMatch(/(^|\s)(אתם|לחצו|תלמדו|שימו)(\s|$)/);
    }
  });
});

describe('route switch', () => {
  beforeEach(() => mem.clear());
  test('off by default: normal text, no note', () => {
    expect(isChessRoute()).toBe(false);
    expect(stageText('king', 'Intro', 'normal')).toBe('normal');
    expect(chessNote('value')).toBeNull();
  });
  test('?route=chess turns it on, ?route=main off', () => {
    routeFromUrl('?route=chess');
    expect(isChessRoute()).toBe(true);
    expect(stageText('king', 'Intro', 'normal')).toBe(strings.il_chess_kingIntro);
    expect(chessNote('value')).toBe(strings.il_chess_valueNote);
    expect(stageText('primitiveClimbingSilver', 'Intro', 'normal')).toBe('normal');
    routeFromUrl('?route=main');
    expect(mem.get(ROUTE_KEY)).toBe('main');
    expect(isChessRoute()).toBe(false);
  });
  test('the course starting point counts when there is no switch on this device', () => {
    mem.set('shogi-il.course', JSON.stringify({ track: 'chess' }));
    expect(isChessRoute()).toBe(true);
    mem.set(ROUTE_KEY, 'main');
    expect(isChessRoute()).toBe(false);
  });
});
