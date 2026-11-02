import { expect, test } from 'bun:test';
import { BOARD_STORIES, HOME_FAQ, PHASES, SHOW_CAPS, STORY } from '../src/lib/home-story';
import { FAQ } from '../src/lib/shogi-faq';
import { hasActivity, isReturning, RETURNING_GUESS, type KeyStore } from '../src/lib/visitor';

const W = (w: string) => new RegExp(`(?<![א-ת])(${w})(?![א-ת])`);

const TAUGHT: { name: string; re: RegExp }[] = [
  { name: 'מלך', re: W('ה?מלך|מלכים') },
  { name: 'מט', re: W('[בלהו]?מט') },
  { name: 'קאנג׳י', re: /קאנג׳י/ },
  { name: 'לוכד', re: /לוכד|לכיד|ללכוד|נלכד|לכדת/ },
  { name: 'הצנחה', re: /הצנח|להצניח/ },
  { name: 'הכתרה', re: /הכתר|מוכתר|להכתיר/ },
];

const NEVER = /צריח|(?<![א-ת])רץ(?![א-ת])|גנרל זהב|גנרל כסף|חייל|פרש|רומח|דרקון|טוקין|(?<![א-ת])שח(?![א-ת])/;

function storyText(): { at: string; text: string; bold: string }[] {
  const out: { at: string; text: string; bold: string }[] = [];
  const caps = (k: 'a' | 'b', s: string) => BOARD_STORIES[k].steps[s]?.cap ?? '';
  for (const k of ['a', 'c', 'b'] as const) {
    for (const s of STORY[k]) {
      const bold = [...s.text.matchAll(/<strong>(.*?)<\/strong>/g)].map((m) => m[1]).join(' ');
      const cap = k === 'c' ? SHOW_CAPS[s.key] : caps(k, s.key);
      out.push({ at: s.key, text: s.text.replace(/<[^>]+>/g, ''), bold });
      out.push({ at: `${s.key}:cap`, text: cap, bold: '' });
    }
  }
  out.push({ at: 'phases', text: PHASES.map((p) => `${p.h} ${p.p}`).join(' '), bold: '' });
  return out;
}

test('story names each concept first in bold, where it is shown', () => {
  const texts = storyText();
  for (const t of TAUGHT) {
    const i = texts.findIndex((x) => t.re.test(x.text));
    expect(i, t.name).toBeGreaterThanOrEqual(0);
    expect(t.re.test(texts[i].bold), `${t.name} first appears at ${texts[i].at} without being taught there`).toBe(true);
  }
});

test('story never names a piece or term it does not teach', () => {
  for (const x of storyText()) expect(NEVER.test(x.text), `${x.at}: ${x.text}`).toBe(false);
});

test('story names the three game phases', () => {
  expect(PHASES.map((p) => p.h)).toEqual(['פתיחה', 'אמצע המשחק', 'סוף המשחק']);
});

test('home FAQ ids all exist', () => {
  for (const id of HOME_FAQ) expect(FAQ.some((f) => f.id === id), id).toBe(true);
  expect(new Set(FAQ.map((f) => f.id)).size).toBe(FAQ.length);
});

const store = (o: Record<string, string>): KeyStore & { setItem(k: string, v: string): void } => {
  const m = new Map(Object.entries(o));
  return { getItem: (k) => m.get(k) ?? null, key: (i) => [...m.keys()][i] ?? null, get length() { return m.size; }, setItem: (k, v) => void m.set(k, v) };
};

const open = (mode: 'ai' | 'local', result?: object) => JSON.stringify({ record: { version: 1, moves: ['7g7f'], level: 1, mode, ...(result ? { result } : {}) }, at: 1 });

const CASES: [string, Record<string, string>, boolean][] = [
  ['empty', {}, false],
  ['empty arrays', { 'shogi-il.play.history': '[]', 'shogi-il.tsume.solved': '{}' }, false],
  ['lesson done', { 'done:01-board': '1' }, true],
  ['learn progress', { 'shogi-il.learn.progress': '{"a":1}' }, true],
  ['two-player history only', { 'shogi-il.play.history': JSON.stringify([{ version: 1, mode: 'local', moves: [] }]) }, true],
  ['open game vs computer', { 'shogi-il.play.current': open('ai') }, true],
  ['open two-player game', { 'shogi-il.play.local.current': open('local') }, true],
  ['finished game in slot', { 'shogi-il.play.current': open('ai', { winner: 'sente' }) }, false],
  ['broken slot', { 'shogi-il.play.current': '{oops' }, false],
  ['other keys', { pieceSet: 'chess', gender: 'f' }, false],
];

test('pre-paint guess and the shared check agree', () => {
  for (const [name, data, want] of CASES) {
    expect(hasActivity(store(data)), name).toBe(want);
    const html = { on: false };
    const doc = { currentScript: { dataset: { auth: '' } }, documentElement: { setAttribute: () => { html.on = true; } } };
    new Function('localStorage', 'document', RETURNING_GUESS)(store(data), doc);
    expect(html.on, `guess: ${name}`).toBe(want);
  }
});

test('a stored session counts as returning', () => {
  expect(isReturning(store({ 'sb-auth': '{}' }), 'sb-auth')).toBe(true);
  const html = { on: false };
  const doc = { currentScript: { dataset: { auth: 'sb-auth' } }, documentElement: { setAttribute: () => { html.on = true; } } };
  new Function('localStorage', 'document', RETURNING_GUESS)(store({ 'sb-auth': '{"x":1}' }), doc);
  expect(html.on).toBe(true);
});
