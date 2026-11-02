import { beforeEach, describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import he from '../src/learn/i18n/he.json';
import { chessOf, hebrewOf, type PieceType } from '../src/lib/sfen';
import { choosePieceSet, defaultPieceSet, markChessPlayer, pieceSetOf, refreshPieceSet, savedPieceSet } from '../src/lib/piece-set';

const mem = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
  key: (i: number) => [...mem.keys()][i] ?? null,
  get length() { return mem.size; },
};
const attrs = new Map<string, string>();
const dataset: Record<string, string | undefined> = {};
const events: string[] = [];
(globalThis as { document?: unknown }).document = {
  documentElement: {
    dataset,
    setAttribute: (k: string, v: string) => { attrs.set(k, v); if (k === 'data-pieces') dataset.pieces = v; },
    getAttribute: (k: string) => attrs.get(k) ?? null,
  },
  dispatchEvent: (e: Event) => { events.push(e.type); return true; },
};
(globalThis as { CustomEvent?: unknown }).CustomEvent ??= class extends Event { detail: unknown; constructor(t: string, o?: { detail?: unknown }) { super(t); this.detail = o?.detail; } };

beforeEach(() => {
  mem.clear();
  attrs.clear();
  events.length = 0;
  dataset.pieces = 'hebrew';
  dataset.piecesDefault = undefined;
});

describe('chess piece set', () => {
  const types: PieceType[] = ['K', 'R', 'B', 'G', 'S', 'N', 'L', 'P'];
  test('pieces with a chess twin get its symbol, the rest keep the Hebrew letter', () => {
    const sym = (t: PieceType, promoted = false) => chessOf({ type: t, side: 'sente', promoted }).replace(/︎/g, '');
    expect(types.map((t) => sym(t))).toEqual(['♚', '♜', '♝', hebrewOf({ type: 'G', side: 'sente', promoted: false }), hebrewOf({ type: 'S', side: 'sente', promoted: false }), '♞', hebrewOf({ type: 'L', side: 'sente', promoted: false }), '♟']);
    expect(sym('R', true)).toBe('♜+');
    expect(sym('P', true)).toBe('♟+');
    expect(sym('S', true)).toBe(hebrewOf({ type: 'S', side: 'sente', promoted: true }));
  });
  test('every chess symbol carries the text-style selector so phones do not draw an emoji', () => {
    for (const t of types) {
      const c = chessOf({ type: t, side: 'sente', promoted: false });
      if (/[♔-♟]/.test(c)) expect(c).toContain('︎');
    }
  });
  test('the set name is read safely', () => {
    expect(pieceSetOf('chess')).toBe('chess');
    expect(pieceSetOf('nonsense')).toBe('hebrew');
  });
});

describe('default piece set', () => {
  test('hebrew for a new visitor', () => {
    expect(defaultPieceSet()).toBe('hebrew');
  });
  test('chess on the chess route, from the lesson link or from placement', () => {
    mem.set('learnRoute', 'chess');
    expect(defaultPieceSet()).toBe('chess');
    mem.clear();
    mem.set('shogi-il.course', JSON.stringify({ route: 'chess' }));
    expect(defaultPieceSet()).toBe('chess');
  });
  test('the main route wins over a visit to the chess page', () => {
    mem.set('pieceSetHint', 'chess');
    mem.set('shogi-il.course', JSON.stringify({ route: 'main' }));
    expect(defaultPieceSet()).toBe('hebrew');
    mem.set('learnRoute', 'chess');
    expect(defaultPieceSet()).toBe('chess');
  });
  test('the chess page marks the visitor as a chess player', () => {
    markChessPlayer();
    expect(dataset.pieces).toBe('chess');
    expect(events).toContain('pieces-changed');
    expect(savedPieceSet()).toBeNull();
  });
  test('a set the learner picked always wins', () => {
    mem.set('learnRoute', 'chess');
    choosePieceSet('kanji');
    refreshPieceSet();
    expect(dataset.pieces).toBe('kanji');
    expect(savedPieceSet()).toBe('kanji');
  });
});

describe('piece tokens in lesson text', () => {
  const css = readFileSync('src/styles/global.css', 'utf8');
  test('every {X} token names a piece the chip knows', () => {
    for (const [k, v] of Object.entries(he as Record<string, string>)) {
      for (const m of v.matchAll(/\{([^}]*)\}/g)) {
        expect(/^\+?[KRBGSNLP]$/.test(m[1]), `${k}: ${m[0]}`).toBe(true);
        expect(css.includes(`.pchip[data-p="${m[1]}"]`), `${k}: ${m[0]}`).toBe(true);
      }
    }
  });
});
