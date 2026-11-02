import { describe, expect, test } from 'bun:test';
import { BAR_SIZE, composeBar, type TipsCtx } from '../src/lib/news-evergreen';
import type { NewsRow, NewsViewer } from '../src/lib/news';

const NOW = Date.parse('2026-11-10T10:00:00Z');
const HOUR = 3600e3;
let nextId = 100;
const update = (hoursAgo: number, r: Partial<NewsRow> = {}): NewsRow => ({
  id: nextId++, kind: 'new', title: `עדכון מלפני ${hoursAgo} שעות`, url: `/u${nextId}/`, audience: 'all',
  starts_at: new Date(NOW - hoursAgo * HOUR).toISOString(), ends_at: new Date(NOW - hoursAgo * HOUR + 7 * 24 * HOUR).toISOString(), ...r,
});
const viewer = (v: Partial<NewsViewer> = {}): NewsViewer => ({ now: NOW, returning: true, signedIn: false, ...v });
const tipsCtx = (t: Partial<TipsCtx> = {}): TipsCtx => ({
  returning: true, installed: false, path: '/', weekOpen: true, links: { settings: '/settings/', whatsapp: 'https://chat.whatsapp.com/x', facebook: 'https://www.facebook.com/share/g/x/' }, ...t,
});
const bar = (rows: NewsRow[], v: Partial<NewsViewer> = {}, t: Partial<TipsCtx> = {}) => {
  const { news, tips } = composeBar(rows, viewer(v), tipsCtx(t));
  return [...news, ...tips];
};
const isTip = (r: NewsRow) => r.kind === 'tip' || r.kind === 'week';

describe('order: the newest update is always first', () => {
  test('updates run newest to oldest, whatever order the database sends', () => {
    const rows = [update(30), update(2), update(50), update(10)];
    expect(bar(rows).map((r) => r.title)).toEqual([2, 10, 30, 50].map((h) => `עדכון מלפני ${h} שעות`));
  });

  test('a new update goes first and pushes the others down one place', () => {
    const before = [update(5), update(20), update(40)];
    const fresh = update(0);
    expect(bar(before).slice(0, 3).map((r) => r.id)).toEqual(before.map((r) => r.id));
    expect(bar([...before, fresh]).map((r) => r.id)).toEqual([fresh.id, ...before.map((r) => r.id)]);
  });

  test('with more than four updates, the oldest ones drop off the bar', () => {
    const rows = [0, 1, 2, 3, 4, 5].map((h) => update(h));
    expect(bar(rows).map((r) => r.id)).toEqual(rows.slice(0, 4).map((r) => r.id));
    expect(bar(rows).some(isTip)).toBe(false);
  });

  test('two updates published at the same moment: the later one first', () => {
    const a = update(1);
    const b = update(1);
    expect(bar([a, b]).slice(0, 2).map((r) => r.id)).toEqual([b.id, a.id]);
  });

  test('an update that ends early lets the next oldest back on', () => {
    const rows = [0, 1, 2, 3, 4].map((h) => update(h));
    rows[0].ends_at = new Date(NOW - 1000).toISOString();
    expect(bar(rows).map((r) => r.id)).toEqual(rows.slice(1, 5).map((r) => r.id));
  });
});

describe('fill: tips only when there are fewer than four updates, always after them', () => {
  for (const n of [0, 1, 2, 3, 4, 5]) {
    test(`${n} updates: ${Math.min(n, 4)} updates, then ${Math.max(0, 4 - n)} tips`, () => {
      const rows = Array.from({ length: n }, (_, i) => update(i + 1));
      const items = bar(rows);
      expect(items).toHaveLength(BAR_SIZE);
      expect(items.filter((r) => !isTip(r))).toHaveLength(Math.min(n, 4));
      const firstTip = items.findIndex(isTip);
      if (firstTip >= 0) expect(items.slice(firstTip).every(isTip)).toBe(true);
    });
  }

  test('newcomers too: updates first, tips after, four in all', () => {
    const items = bar([update(1)], { returning: false }, { returning: false });
    expect(items).toHaveLength(BAR_SIZE);
    expect(isTip(items[0])).toBe(false);
    expect(items.slice(1).every(isTip)).toBe(true);
  });

  test('updates the reader already closed do not count, and tips take their place after the rest', () => {
    const rows = [update(1), update(2), update(3), update(4)];
    const items = bar(rows, { read: [`news:${rows[0].id}`] });
    expect(items.slice(0, 3).map((r) => r.id)).toEqual(rows.slice(1).map((r) => r.id));
    expect(isTip(items[3])).toBe(true);
  });

  test('a tip never repeats the link of an update on the bar', () => {
    const items = bar([update(1, { url: '/play/' })]);
    expect(items.filter((r) => r.url === '/play/')).toHaveLength(1);
  });

  test('switched off in the bell: no updates and no tips', () => {
    expect(bar([update(1)], { off: true })).toEqual([]);
  });

  test('tips resting after the reader closed them: updates still show, alone', () => {
    const items = bar([update(1)], {}, { restUntil: NOW + HOUR });
    expect(items).toHaveLength(1);
    expect(isTip(items[0])).toBe(false);
  });

  test('the puzzle of the week is a tip: it never jumps ahead of an update', () => {
    const items = bar([update(1), update(2)], {}, { weekOpen: true });
    expect(items.findIndex((r) => r.kind === 'week')).toBe(2);
  });
});
