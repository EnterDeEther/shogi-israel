import { describe, expect, test } from 'bun:test';
import { campaignOf, countAd, tourEvent } from '../src/lib/ad-count';
import { adPlayLines } from '../src/lib/admin-report';

const memory = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};
const AD = { source: 'meta', medium: 'paid_social', campaign: 'chess-test-nov26', landing: '/play/' };

describe('ad counter', () => {
  test('counts only visitors who came from an ad, each thing once per tab', () => {
    const sent: unknown[] = [];
    const send = (b: unknown) => void sent.push(b);
    const store = memory();
    expect(countAd('start', 1, { source: null, store, send })).toBe(false);
    expect(countAd('start', 1, { source: AD, store, send })).toBe(true);
    expect(countAd('start', 1, { source: AD, store, send })).toBe(false);
    expect(countAd('win', 1, { source: AD, store, send })).toBe(true);
    expect(countAd('win', 2, { source: AD, store, send })).toBe(true);
    expect(sent).toEqual([
      { p_campaign: 'meta / paid_social / chess-test-nov26', p_event: 'start', p_level: 1 },
      { p_campaign: 'meta / paid_social / chess-test-nov26', p_event: 'win', p_level: 1 },
      { p_campaign: 'meta / paid_social / chess-test-nov26', p_event: 'win', p_level: 2 },
    ]);
  });

  test('sends nothing that could identify the visitor', () => {
    const sent: Record<string, unknown>[] = [];
    countAd('start', 3, { source: { ...AD, content: 'card2', landing: '/play/?x=1' }, store: memory(), send: (b) => void sent.push(b) });
    expect(Object.keys(sent[0]).sort()).toEqual(['p_campaign', 'p_event', 'p_level']);
    expect(campaignOf({ source: 'google', landing: '/' })).toBe('google');
  });

  test('tells a skipped tour from one taken part way or to the end', () => {
    expect(tourEvent({ id: 'play', how: 'skipped', at: -1 })).toBe('tour_skip');
    expect(tourEvent({ id: 'play', how: 'skipped', at: 3 })).toBe('tour_part');
    expect(tourEvent({ id: 'play', how: 'left', at: 0 })).toBe('tour_part');
    expect(tourEvent({ id: 'play', how: 'done', at: 7 })).toBe('tour_done');
    expect(tourEvent({ id: 'site', how: 'done' })).toBeNull();
  });

  test('the weekly owner email sums the week per ad', () => {
    const c = 'meta / paid_social / chess-test-nov26';
    const lines = adPlayLines([
      { campaign: c, event: 'start', level: 1, n: 10 },
      { campaign: c, event: 'start', level: 2, n: 3 },
      { campaign: c, event: 'start', level: 0, n: 1 },
      { campaign: c, event: 'win', level: 1, n: 4 },
      { campaign: c, event: 'win', level: 1, n: 2 },
      { campaign: c, event: 'win', level: 2, n: 1 },
      { campaign: c, event: 'tour_done', level: 0, n: 2 },
      { campaign: c, event: 'tour_part', level: 0, n: 1 },
      { campaign: c, event: 'tour_skip', level: 0, n: 5 },
      { campaign: c, event: 'inapp_card', level: 0, n: 6 },
      { campaign: c, event: 'open_chrome', level: 0, n: 3 },
    ]);
    expect(lines).toEqual([
      `ממודעה ${c}: התחילו משחק נגד המחשב 13. שני שחקנים 1. ניצחו: רמה 1 6, רמה 2 1. סיור: נכנסו 3 (עד הסוף 2), דילגו 5. כרטיס "פתיחה בדפדפן" הוצג 6, לחצו על Chrome 3. (לפי לשונית, לא לפי אדם)`,
    ]);
  });
});
