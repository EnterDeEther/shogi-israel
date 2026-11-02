import { describe, expect, test } from 'bun:test';
import { CTA_MAX, NEWS_KIND, NEWS_KINDS, NEWS_LIVE, NEWS_MAX, NEWS_TARGET, newsCta, newsDwell, newsHref, newsLength, newsParts, newsProblems, newsUrlOk, pickNews, plainNews, type NewsRow } from '../src/lib/news';
import { readFileSync } from 'node:fs';

const NOW = Date.parse('2026-11-03T10:00:00Z');
const iso = (days: number) => new Date(NOW + days * 864e5).toISOString();
let next = 1;
const row = (r: Partial<NewsRow> = {}): NewsRow => ({ id: next++, kind: 'new', title: 'אפשר להתקין את האתר בטלפון', url: '/app/', audience: 'all', starts_at: iso(-1), ends_at: iso(6), ...r });
const newcomer = { now: NOW, returning: false, signedIn: false };
const back = { now: NOW, returning: true, signedIn: false };

const LAUNCH = [
  { kind: 'new', title: 'שחקני שחמט? אפשר לשחק עכשיו עם כלים בסימני שחמט ♚♜♞', cta: '⟦נסה|נסי⟧ עכשיו', len: 51 },
  { kind: 'changed', title: 'הרגלי נקרא עכשיו **חייל**, עם האות {ח}. הרומח מסומן {ר}.', cta: '⟦ראה|ראי⟧ את הכלים', len: 50 },
  { kind: 'new', title: 'אפשר להתקין את האתר בטלפון, ולבחור אילו התראות לקבל', cta: 'איך מתקינים', len: 51 },
  { kind: 'new', title: 'שוגי ישראל באינסטגרם: חידות, מהלך השבוע וסיפורי קהילה', cta: '⟦עקוב|עקבי⟧ אחרינו', len: 53 },
];

describe('length rules', () => {
  test('counts the longer gender form, a chip as 2, bold marks as nothing', () => {
    expect(newsLength('⟦לחץ|לחצי⟧')).toBe(4);
    expect(newsLength('האות {ח}')).toBe(7);
    expect(newsLength('**חייל**')).toBe(4);
    expect(newsLength('♚♜♞')).toBe(3);
  });

  test('the launch updates are within the target', () => {
    for (const u of LAUNCH) {
      expect(newsLength(u.title)).toBe(u.len);
      expect(newsLength(u.title)).toBeLessThanOrEqual(NEWS_TARGET);
      expect(newsProblems(u.title)).toEqual([]);
      expect(newsLength(u.cta)).toBeLessThanOrEqual(CTA_MAX);
    }
  });

  test('every type has a short label and a default button within the limit', () => {
    for (const k of NEWS_KINDS) {
      expect(newsLength(NEWS_KIND[k].cta)).toBeLessThanOrEqual(CTA_MAX);
      expect(newsProblems(NEWS_KIND[k].cta, CTA_MAX)).toEqual([]);
      expect(NEWS_KIND[k].label.length).toBeLessThanOrEqual(8);
    }
  });

  test('what the rules refuse', () => {
    expect(newsProblems('א'.repeat(NEWS_MAX))).toEqual([]);
    expect(newsProblems('א'.repeat(NEWS_MAX + 1))).toEqual(['length']);
    expect(newsProblems('⟦נסה עכשיו')).toContain('token');
    expect(newsProblems('**חצי מודגש')).toContain('bold');
    expect(newsProblems('שורה\nשנייה')).toContain('markup');
    expect(newsProblems('<b>x</b>')).toContain('markup');
    expect(newsProblems('{חייל}')).toContain('chip');
    expect(newsProblems('חדש באתר!')).toContain('exclamation');
    expect(newsProblems('חדש באתר 🎉')).toContain('emoji');
    expect(newsProblems('')).toContain('empty');
  });

  test('the database applies the same limits', () => {
    const sql = readFileSync(new URL('../supabase/migrations/0010_news.sql', import.meta.url), 'utf8');
    expect(sql).toContain(`news_len(title) between 1 and ${NEWS_MAX}`);
    expect(sql).toContain(`news_len(cta_label) between 1 and ${CTA_MAX}`);
    expect(sql).toContain("interval '7 days'");
  });
});

describe('links', () => {
  test('our pages and our own social accounts only', () => {
    for (const u of ['/', '/chess/#pieces', 'https://shogi.co.il/app/', 'https://www.instagram.com/shogi.israel/', 'https://chat.whatsapp.com/abc', 'https://lishogi.org/team/x', null, '']) expect(newsUrlOk(u)).toBe(true);
    for (const u of ['//evil.example/', 'https://evil.example/', 'https://shogi.co.il.evil.example/', 'http://shogi.co.il/', 'javascript:alert(1)', 'https://shogi.co.il:8443/', '/a b']) expect(newsUrlOk(u)).toBe(false);
    expect(newsHref({ url: 'https://evil.example/' })).toBe('/');
  });
});

describe('who sees what', () => {
  test('newcomers see only new things, never changes they could not notice', () => {
    const rows = [row({ kind: 'new' }), row({ kind: 'content' }), row({ kind: 'important' }), row({ kind: 'changed' }), row({ kind: 'moved' }), row({ kind: 'fixed' })];
    expect(pickNews(rows, newcomer).map((r) => r.kind).sort()).toEqual(['content', 'important', 'new']);
    expect(pickNews(rows, back)).toHaveLength(NEWS_LIVE);
  });

  test('audience: returning visitors, and signed-in players', () => {
    const r = row({ audience: 'returning', kind: 'new' });
    const s = row({ audience: 'signed_in', kind: 'new' });
    expect(pickNews([r, s], newcomer)).toEqual([]);
    expect(pickNews([r, s], back)).toEqual([r]);
    expect(pickNews([r, s], { now: NOW, returning: false, signedIn: true })).toHaveLength(2);
  });

  test('newest first, at most four, not before it starts or after it ends', () => {
    const rows = [1, 2, 3, 4, 5].map((d) => row({ starts_at: iso(-d) }));
    expect(pickNews(rows, back).map((r) => r.id)).toEqual(rows.slice(0, 4).map((r) => r.id));
    expect(pickNews([row({ starts_at: iso(1) }), row({ ends_at: iso(-0.1) })], back)).toEqual([]);
  });

  test('read or switched off in the bell: not on the bar', () => {
    const a = row();
    const b = row();
    expect(pickNews([a, b], { ...back, read: [`news:${a.id}`] })).toEqual([b]);
    expect(pickNews([a, b], { ...back, off: true })).toEqual([]);
  });

  test('a row with a foreign link is dropped', () => {
    expect(pickNews([row({ url: 'https://evil.example/' })], back)).toEqual([]);
  });
});

describe('text and timing', () => {
  test('bold, piece chips and chess symbols become their own parts', () => {
    expect(newsParts('נקרא **חייל**, האות {ח}. כלים ♚♜︎')).toEqual([
      { t: 'text', s: 'נקרא ' }, { t: 'bold', s: 'חייל' }, { t: 'text', s: ', האות ' }, { t: 'chip', s: 'ח' }, { t: 'text', s: '. כלים ' }, { t: 'chess', s: '♚♜' },
    ]);
    expect(plainNews('נקרא **חייל**, האות {ח}.')).toBe('נקרא חייל, האות ח.');
  });

  test('a default button per type', () => {
    expect(newsCta({ kind: 'fixed', cta_label: null })).toBe(NEWS_KIND.fixed.cta);
    expect(newsCta({ kind: 'new', cta_label: 'איך מתקינים' })).toBe('איך מתקינים');
    expect(newsCta({ kind: 'bogus', cta_label: null })).toBe(NEWS_KIND.new.cta);
  });

  test('time on screen grows with the words, between 4.2 and 10 seconds', () => {
    expect(newsDwell('קצר', 'לפרטים')).toBe(4200);
    const long = newsDwell('מילה '.repeat(40), 'לפרטים');
    expect(long).toBe(10000);
    const mid = newsDwell(LAUNCH[0].title, 'נסה עכשיו');
    expect(mid).toBeGreaterThan(4200);
    expect(mid).toBeLessThan(10000);
    expect(newsDwell(LAUNCH[0].title, 'נסה עכשיו', 'slow')).toBeGreaterThan(mid);
    expect(newsDwell(LAUNCH[0].title, 'נסה עכשיו', 'fast')).toBeLessThan(mid);
  });
});
