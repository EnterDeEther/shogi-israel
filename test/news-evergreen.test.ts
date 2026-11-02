import { describe, expect, test } from 'bun:test';
import { existsSync, readdirSync } from 'node:fs';
import { BAR_SIZE, LINK_SLOTS, TIPS, WEEK_TIP, israelDayNumber, pickEvergreen, type EvergreenCtx } from '../src/lib/news-evergreen';
import { CTA_MAX, NEWS_TARGET, newsLength, newsProblems, newsUrlOk, pickNews } from '../src/lib/news';

const NOW = Date.parse('2026-11-10T10:00:00Z');
const ctx = (c: Partial<EvergreenCtx> = {}): EvergreenCtx => ({
  now: NOW, returning: false, installed: false, path: '/', weekOpen: true, links: { settings: '/settings/', whatsapp: 'https://chat.whatsapp.com/abc', facebook: 'https://www.facebook.com/share/g/abc/' }, taken: [], ...c,
});
const page = (url: string) => {
  const path = url.replace(/[#?].*$/, '').replace(/^\/|\/$/g, '');
  if (!path || ['.astro', '/index.astro'].some((e) => existsSync(`src/pages/${path}${e}`))) return true;
  const [dir, slug] = path.split('/');
  if (dir === 'tsume') return existsSync(`src/tsume/data/mate${slug}.json`);
  if (dir === 'rules') return readdirSync('src/content/rules').some((f) => f.startsWith(`${slug}.`));
  return false;
};

describe('the always-on pool follows the entry rules', () => {
  test('every tip is short, well formed, and links to a live page or our own accounts', () => {
    for (const t of [WEEK_TIP, ...TIPS]) {
      expect({ key: t.key, problems: newsProblems(t.title) }).toEqual({ key: t.key, problems: [] });
      expect(newsLength(t.title)).toBeLessThanOrEqual(NEWS_TARGET);
      expect(newsLength(t.cta)).toBeLessThanOrEqual(CTA_MAX);
      expect(newsProblems(t.cta, CTA_MAX)).toEqual([]);
      if ((LINK_SLOTS as string[]).includes(t.url)) continue;
      expect(newsUrlOk(t.url)).toBe(true);
      if (t.url.startsWith('/')) expect({ url: t.url, live: page(t.url) }).toEqual({ url: t.url, live: true });
    }
    expect(new Set(TIPS.map((t) => t.key)).size).toBe(TIPS.length);
  });
});

describe('filling the bar', () => {
  test('gives as many tips as asked, up to the bar size', () => {
    expect(pickEvergreen(ctx(), BAR_SIZE)).toHaveLength(4);
    expect(pickEvergreen(ctx(), 1)).toHaveLength(1);
    expect(pickEvergreen(ctx(), 0)).toEqual([]);
  });

  test('always-on items never claim to be new, and never enter the read list', () => {
    for (const r of pickEvergreen(ctx({ returning: true }), 5)) {
      expect(['tip', 'week']).toContain(r.kind);
      expect(r.id).toBeLessThan(0);
    }
  });

  test('newcomers get no returning-only tips and no puzzle', () => {
    const keys = new Set(TIPS.filter((t) => t.audience === 'returning').map((t) => t.title));
    for (let d = 0; d < 20; d++) {
      for (const r of pickEvergreen(ctx({ now: NOW + d * 864e5 }), BAR_SIZE)) {
        expect(keys.has(r.title)).toBe(false);
        expect(r.kind).toBe('tip');
      }
    }
  });

  test('the week puzzle leads for returning visitors until it is solved', () => {
    expect(pickEvergreen(ctx({ returning: true }), 3)[0].kind).toBe('week');
    expect(pickEvergreen(ctx({ returning: true, weekOpen: false }), 3).map((r) => r.kind)).not.toContain('week');
  });

  test('a different first tip each day', () => {
    const first = (d: number) => pickEvergreen(ctx({ now: NOW + d * 864e5 }), 1)[0].title;
    for (let d = 0; d < 6; d++) expect(first(d + 1)).not.toBe(first(d));
    expect(israelDayNumber(Date.parse('2026-11-10T21:30:00Z'))).toBe(israelDayNumber(Date.parse('2026-11-11T06:00:00Z')));
  });

  test('skips what does not fit: installed app, this page, links an update already shows', () => {
    const all = (c: Partial<EvergreenCtx>) => [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].flatMap((d) => pickEvergreen(ctx({ now: NOW + d * 864e5, returning: true, ...c }), 3).map((r) => r.url));
    expect(all({})).toContain('/app/');
    expect(all({ installed: true })).not.toContain('/app/');
    expect(all({ path: '/app/' })).not.toContain('/app/');
    expect(all({ taken: ['/chess/#pieces'] })).not.toContain('/chess/');
    expect(all({ links: { settings: '/app/#settings' } })).toContain('/app/#settings');
    expect(all({ links: {} }).every((u) => u.startsWith('/'))).toBe(true);
  });

  test('after the reader closes tips, they rest for a few days', () => {
    expect(pickEvergreen(ctx({ restUntil: NOW + 1000 }), 3)).toEqual([]);
    expect(pickEvergreen(ctx({ restUntil: NOW - 1000 }), 3)).toHaveLength(3);
  });

  test('database rows can never pose as tips', () => {
    const row = { id: 5, kind: 'tip', title: 'x', url: '/', starts_at: new Date(NOW - 1000).toISOString(), ends_at: new Date(NOW + 1000).toISOString() };
    expect(pickNews([row], { now: NOW, returning: true, signedIn: true })).toEqual([]);
  });
});
