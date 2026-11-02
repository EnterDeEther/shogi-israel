import { resolve, TOKEN, type Gender } from './gender.js';

export type NewsKind = 'new' | 'content' | 'changed' | 'moved' | 'fixed' | 'important' | 'tip' | 'week';
export type NewsAudience = 'all' | 'returning' | 'signed_in';

export interface NewsRow {
  id: number;
  kind?: string | null;
  title: string;
  body?: string | null;
  url?: string | null;
  cta_label?: string | null;
  audience?: string | null;
  starts_at: string;
  ends_at?: string | null;
}

export const NEWS_TARGET = 55;
export const NEWS_MAX = 70;
export const CTA_MAX = 16;
export const NEWS_LIVE = 4;
export const NEWS_DAYS = 7;
export const NEWS_COLUMNS = 'id, kind, title, body, url, cta_label, audience, starts_at, ends_at';

export const NEWS_KINDS: NewsKind[] = ['new', 'content', 'important', 'changed', 'moved', 'fixed'];
export const ALWAYS_KINDS: NewsKind[] = ['tip', 'week'];
export const NEWS_KIND: Record<NewsKind, { label: string; cta: string; loud: boolean }> = {
  new: { label: 'חדש', cta: '⟦נסה|נסי⟧ עכשיו', loud: true },
  content: { label: 'תוכן חדש', cta: '⟦קרא|קראי⟧ עכשיו', loud: true },
  important: { label: 'חשוב', cta: 'לפרטים', loud: true },
  changed: { label: 'השתנה', cta: 'מה השתנה', loud: false },
  moved: { label: 'עבר מקום', cta: 'למקום החדש', loud: false },
  fixed: { label: 'תוקן', cta: '⟦נסה|נסי⟧ שוב', loud: false },
  tip: { label: 'ידעת?', cta: 'לפרטים', loud: false },
  week: { label: 'בעיית השבוע', cta: '⟦פתור|פתרי⟧ עכשיו', loud: false },
};
const FOR_NEWCOMERS = new Set<NewsKind>(['new', 'content', 'important']);

export const asKind = (k: unknown): NewsKind => (typeof k === 'string' && Object.prototype.hasOwnProperty.call(NEWS_KIND, k) ? (k as NewsKind) : 'new');
export const newsId = (id: number): string => `news:${id}`;

export type NewsPart = { t: 'text' | 'bold' | 'chip' | 'chess'; s: string };

const CHESS = /[\u2654-\u265F\uE000-\uE002]\uFE0E?/;

export function newsParts(text: string): NewsPart[] {
  const out: NewsPart[] = [];
  const re = /\*\*([^*]+)\*\*|\{([^{}]{1,2})\}|((?:[\u2654-\u265F\uE000-\uE002]\uFE0E?)+)/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index > last) out.push({ t: 'text', s: text.slice(last, m.index) });
    if (m[1] != null) out.push({ t: 'bold', s: m[1] });
    else if (m[2] != null) out.push({ t: 'chip', s: m[2] });
    else out.push({ t: 'chess', s: m[3].replace(/\uFE0E/g, '') });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ t: 'text', s: text.slice(last) });
  return out;
}

export const plainNews = (text: string): string => text.replace(/\*\*/g, '').replace(/\{([^{}]{1,2})\}/g, '$1').replace(/\uFE0E/g, '');

const form = (text: string, g: Gender): string => resolve(text, g).replace(/\*\*/g, '').replace(/\{[^{}]{1,2}\}/g, 'xx').replace(/\uFE0E/g, '');

export const newsLength = (text: string): number => Math.max([...form(text, 'm')].length, [...form(text, 'f')].length);

export function newsProblems(text: string, max = NEWS_MAX): string[] {
  const p: string[] = [];
  if (!text.trim()) p.push('empty');
  if (/[\r\n\t<>]/.test(text)) p.push('markup');
  if (/[\u27E6\u27E7]/.test(text.replace(TOKEN, ''))) p.push('token');
  if (/[{}]/.test(text.replace(/\{[^{}]{1,2}\}/g, ''))) p.push('chip');
  const bold = text.split('**').length - 1;
  if (bold !== 0 && bold !== 2) p.push('bold');
  if (/!/.test(text)) p.push('exclamation');
  if (/\p{Extended_Pictographic}/u.test(text.replace(new RegExp(CHESS.source, 'gu'), ''))) p.push('emoji');
  if (newsLength(text) > max) p.push('length');
  return [...new Set(p)];
}

const OUR_HOSTS = /^(www\.)?(shogi\.co\.il|instagram\.com|facebook\.com|chat\.whatsapp\.com|lishogi\.org)$/;

export function newsUrlOk(url: string | null | undefined): boolean {
  if (url == null || url === '') return true;
  if (/[\s"<>]/.test(url)) return false;
  if (url === '/' || /^\/[^/]/.test(url)) return true;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && !u.port && !u.username && OUR_HOSTS.test(u.hostname);
  } catch { return false; }
}

export const newsHref = (row: Pick<NewsRow, 'url'>): string => (row.url && newsUrlOk(row.url) ? row.url : '/');
export const newsCta = (row: Pick<NewsRow, 'kind' | 'cta_label'>): string => row.cta_label || NEWS_KIND[asKind(row.kind)].cta;

export const isLiveNews = (row: Pick<NewsRow, 'starts_at' | 'ends_at'>, now: number): boolean =>
  Date.parse(row.starts_at) <= now && (!row.ends_at || Date.parse(row.ends_at) > now);

export interface NewsViewer { now: number; returning: boolean; signedIn: boolean; read?: string[]; off?: boolean }

export function seesNews(row: NewsRow, v: NewsViewer): boolean {
  const kind = asKind(row.kind);
  const aud = (row.audience ?? 'all') as NewsAudience;
  if (aud === 'signed_in' && !v.signedIn) return false;
  if (aud === 'returning' && !v.returning && !v.signedIn) return false;
  if (!v.returning && !v.signedIn && !FOR_NEWCOMERS.has(kind)) return false;
  return true;
}

export function pickNews(rows: NewsRow[], v: NewsViewer): NewsRow[] {
  if (v.off) return [];
  const read = new Set(v.read ?? []);
  return rows
    .filter((r) => r && typeof r.title === 'string' && isLiveNews(r, v.now) && newsUrlOk(r.url) && !newsProblems(r.title).includes('markup'))
    .filter((r) => !read.has(newsId(r.id)) && !ALWAYS_KINDS.includes(asKind(r.kind)) && seesNews(r, v))
    .sort((a, b) => Date.parse(b.starts_at) - Date.parse(a.starts_at) || b.id - a.id)
    .slice(0, NEWS_LIVE);
}

export const NEWS_SPEEDS = { slow: 1.35, normal: 1, fast: 0.75 } as const;
export type NewsSpeed = keyof typeof NEWS_SPEEDS;
export const NEWS_ROUNDS = 3;

export function newsDwell(text: string, cta: string, speed: NewsSpeed = 'normal'): number {
  const words = plainNews(`${text} ${cta}`).split(/\s+/).filter(Boolean).length;
  return Math.round(Math.min(10000, Math.max(4200, 1800 + words * 320)) * NEWS_SPEEDS[speed]);
}
