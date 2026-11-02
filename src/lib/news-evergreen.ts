import { NEWS_LIVE, pickNews, type NewsRow, type NewsViewer } from './news.js';
import { WEEK_LENGTH } from '../tsume/week.js';

export interface Evergreen {
  key: string;
  kind: 'tip' | 'week';
  title: string;
  cta: string;
  url: string;
  audience: 'all' | 'returning';
  notInstalled?: boolean;
}

export type LinkSlot = 'settings' | 'whatsapp' | 'facebook';
export const LINK_SLOTS: LinkSlot[] = ['settings', 'whatsapp', 'facebook'];
const isSlot = (u: string): u is LinkSlot => (LINK_SLOTS as string[]).includes(u);

export const WEEK_TIP: Evergreen = {
  key: 'week', kind: 'week', title: 'מט בשלושה מהלכים, ובכל יום ראשון בעיה חדשה', cta: '⟦פתור|פתרי⟧ עכשיו', url: `/tsume/${WEEK_LENGTH}/`, audience: 'returning',
};

export const TIPS: Evergreen[] = [
  { key: 'play', kind: 'tip', title: 'אפשר לשחק כאן נגד המחשב, בלי הרשמה ובלי להוריד כלום', cta: '⟦שחק|שחקי⟧ עכשיו', url: '/play/', audience: 'all' },
  { key: 'history', kind: 'tip', title: 'שוגי הוא השחמט של יפן, ומשחקים בו שם כבר מאות שנים', cta: 'לסיפור המלא', url: '/history/', audience: 'all' },
  { key: 'whatsapp', kind: 'tip', title: 'שוגי ישראל בוואטסאפ: שאלות, משחקים ושחקנים מכל הארץ', cta: '⟦הצטרף|הצטרפי⟧', url: 'whatsapp', audience: 'all' },
  { key: 'lessons', kind: 'tip', title: 'כל שיעור לוקח כמה דקות, בעברית ומאפס', cta: '⟦התחל|התחילי⟧ כאן', url: '/try/', audience: 'all' },
  { key: 'drops', kind: 'tip', title: 'בשוגי כלי שנלכד לא יוצא מהמשחק: הוא עובר לצד שלך', cta: '⟦ראה|ראי⟧ איך', url: '/rules/04-drops/', audience: 'all' },
  { key: 'tsume', kind: 'tip', title: 'יש כאן יותר מ-3,500 בעיות מט, מקלות ועד קשות', cta: 'לבעיות', url: '/tsume/', audience: 'returning' },
  { key: 'chess', kind: 'tip', title: 'שחקני שחמט? יש כאן מסלול שמתחיל ממה ⟦שאתה|שאת⟧ כבר ⟦יודע|יודעת⟧', cta: '⟦התחל|התחילי⟧ כאן', url: '/chess/', audience: 'all' },
  { key: 'install', kind: 'tip', title: 'אפשר להתקין את האתר בטלפון, כמו אפליקציה', cta: 'איך מתקינים', url: '/app/', audience: 'all', notInstalled: true },
  { key: 'facebook', kind: 'tip', title: 'קבוצת שוגי ישראל בפייסבוק: שאלות, משחקים ועדכונים', cta: '⟦הצטרף|הצטרפי⟧', url: 'facebook', audience: 'all' },
  { key: 'pieces', kind: 'tip', title: 'אפשר לבחור סימני כלים: עברית, אנגלית, קאנג׳י או שחמט', cta: 'להגדרות', url: 'settings', audience: 'returning' },
];

export const BAR_SIZE = NEWS_LIVE;
export const TIPS_REST_DAYS = 3;

export interface EvergreenCtx {
  now: number;
  returning: boolean;
  installed: boolean;
  path: string;
  weekOpen: boolean;
  links: Partial<Record<LinkSlot, string>>;
  taken: (string | null | undefined)[];
  restUntil?: number;
}

const DAY = 864e5;
export const israelDayNumber = (now: number): number => Math.floor((now + 3 * 3600e3) / DAY);

const pathOf = (url: string): string => {
  try { const u = new URL(url, 'https://shogi.co.il'); return u.host === 'shogi.co.il' ? u.pathname : u.href; } catch { return url; }
};

export function pickEvergreen(ctx: EvergreenCtx, need: number): NewsRow[] {
  if (need <= 0 || (ctx.restUntil && ctx.restUntil > ctx.now)) return [];
  const taken = new Set([pathOf(ctx.path), ...ctx.taken.filter(Boolean).map((u) => pathOf(u!))]);
  const href = (t: Evergreen): string => (isSlot(t.url) ? ctx.links[t.url] ?? '' : t.url);
  const fits = (t: Evergreen) => {
    const url = href(t);
    return !!url && (t.audience === 'all' || ctx.returning) && !(t.notInstalled && ctx.installed) && !taken.has(pathOf(url));
  };
  const day = israelDayNumber(ctx.now);
  const pool = TIPS.filter(fits);
  const turn = pool.length ? day % pool.length : 0;
  const order = [...(ctx.weekOpen && fits(WEEK_TIP) ? [WEEK_TIP] : []), ...pool.slice(turn), ...pool.slice(0, turn)];
  return order.slice(0, need).map((t, i) => ({
    id: -(i + 1),
    kind: t.kind,
    title: t.title,
    cta_label: t.cta,
    url: href(t),
    audience: t.audience,
    starts_at: new Date(day * DAY).toISOString(),
    ends_at: null,
  }));
}

export type TipsCtx = Omit<EvergreenCtx, 'now' | 'taken'>;

export function composeBar(rows: NewsRow[], viewer: NewsViewer, tips: TipsCtx): { news: NewsRow[]; tips: NewsRow[] } {
  const news = pickNews(rows, viewer);
  const fill = viewer.off ? [] : pickEvergreen({ ...tips, now: viewer.now, taken: news.map((r) => r.url) }, BAR_SIZE - news.length);
  return { news, tips: fill };
}
