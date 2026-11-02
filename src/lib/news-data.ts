import { SUPABASE_KEY, SUPABASE_URL, accountsEnabled } from './account-config';
import { NEWS_COLUMNS, type NewsRow } from './news';

const KEY = 'shogi-il.news';
const TTL = 30 * 60 * 1000;

type Cache = { at: number; list: NewsRow[] };

export function cachedNews(): Cache | null {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) || 'null');
    return c && typeof c.at === 'number' && Array.isArray(c.list) ? c : null;
  } catch { return null; }
}

let pending: Promise<NewsRow[]> | null = null;

export function loadNews(force = false): Promise<NewsRow[]> {
  const c = cachedNews();
  if (!force && c && Date.now() - c.at < TTL) return Promise.resolve(c.list);
  if (!accountsEnabled) return Promise.resolve([]);
  pending ??= (async () => {
    try {
      const now = new Date().toISOString();
      const q = new URLSearchParams({ select: NEWS_COLUMNS.replace(/\s/g, ''), starts_at: `lte.${now}`, ends_at: `gt.${now}`, order: 'starts_at.desc', limit: '8' });
      const res = await fetch(`${SUPABASE_URL}/rest/v1/notices?${q}`, { headers: { apikey: SUPABASE_KEY } });
      if (!res.ok) return c?.list ?? [];
      const list = (await res.json()) as NewsRow[];
      try { localStorage.setItem(KEY, JSON.stringify({ at: Date.now(), list })); } catch { }
      return list;
    } catch {
      return c?.list ?? [];
    } finally {
      pending = null;
    }
  })();
  return pending;
}
