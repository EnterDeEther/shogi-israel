import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { PLAY_TOUR, isTourId, readTourEnd, writeTourEnd } from '../src/lib/tour';
import { TIPS_KEY, TIP_TEXT, newHere, tipDue, tipSeen, welcomeTips } from '../src/play/tour';

const memory = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
};
const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('play tour', () => {
  test('walks the board first, then the table, in the order a phone shows it', () => {
    expect(PLAY_TOUR.steps.map((s) => s.target)).toEqual(['play-armies', 'play-hand', 'play-zone', 'play-tools', 'play-moves', 'play-pieces']);
    expect(isTourId('play')).toBe(true);
  });

  test('every step has a hook on the page', () => {
    const page = source('../src/play/view.ts') + source('../src/play/tour.ts');
    for (const s of PLAY_TOUR.steps) expect(page).toContain(`'${s.target}'`);
  });

  test('uses the glossary words and only promises what the page does', () => {
    const text = JSON.stringify([PLAY_TOUR, TIP_TEXT]);
    for (const w of ['הצנחה', 'הכתרה', 'לכדת', 'אזור ההכתרה']) expect(text).toContain(w);
    for (const w of ['מוכתר', 'בהיר', 'כהה', 'להניח', 'במקום מהלך']) expect(text).not.toContain(w);
    expect(PLAY_TOUR.intro.title).toBe('פעם ראשונה כאן?');
    expect(PLAY_TOUR.intro.primary).toBe('לסיור');
    expect(PLAY_TOUR.intro.secondary).toBe('ישר למשחק');
    expect(PLAY_TOUR.end.primary).toBe('למשחק');
    expect(PLAY_TOUR.end.stay).toBe(true);
  });

  test('keeps its answer apart from the other tours', () => {
    const s = memory();
    writeTourEnd(s, 'skipped', 'play');
    expect(readTourEnd(s, 'play')).toBe('skipped');
    expect(readTourEnd(s, 'site')).toBeNull();
  });
});

describe('one-time tips', () => {
  test('only a device that started here new gets them, and each one once', () => {
    const s = memory();
    expect(tipDue('capture', s)).toBe(false);
    tipSeen('capture', s);
    expect(s.m.has(TIPS_KEY)).toBe(false);
    welcomeTips(s);
    expect(tipDue('capture', s)).toBe(true);
    tipSeen('capture', s);
    expect(tipDue('capture', s)).toBe(false);
    expect(tipDue('promote', s)).toBe(true);
    welcomeTips(s);
    expect(tipDue('capture', s)).toBe(false);
    s.m.set(TIPS_KEY, '{oops');
    expect(tipDue('promote', s)).toBe(false);
  });

  test('the tour is offered once: not with a game on the board, an answer, or tips already given', () => {
    const s = memory();
    expect(newHere({ record: undefined }, s)).toBe(true);
    expect(newHere({ record: {} as never }, s)).toBe(false);
    welcomeTips(s);
    expect(newHere({ record: undefined }, s)).toBe(false);
    const t = memory();
    writeTourEnd(t, 'done', 'play');
    expect(newHere({ record: undefined }, t)).toBe(false);
  });
});
