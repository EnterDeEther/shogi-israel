import type { IconName } from './icons';

export interface NavLink {
  href: string;
  label: string;
  hint?: string;
  external?: boolean;
  sub?: boolean;
  icon?: IconName;
}
export interface NavSection {
  label: string;
  blurb?: string;
  tour?: string;
  icon?: IconName;
  links: NavLink[];
}
export type NavItem = NavSection | NavLink;
export const isSection = (i: NavItem): i is NavSection => 'links' in i;

export const WHATSAPP_URL = 'https://chat.whatsapp.com/Hl05iCdO2OY1rJIETuAien';
export const INSTAGRAM_URL = 'https://www.instagram.com/shogi.israel/';
export const FACEBOOK_PAGE_URL = 'https://www.facebook.com/shogi.israel';
export const FACEBOOK_GROUP_URL = 'https://www.facebook.com/share/g/1DXk7iY3wp/';
export { CONTACT_EMAIL } from './contact';

export const NAV: NavItem[] = [
  {
    label: '⟦הכר|הכירי⟧ את השוגי',
    tour: 'know',
    icon: 'fan',
    blurb: 'מה זה שוגי ומאיפה הוא בא, איך עובדות הדרגות, ומה מוכר ומה חדש אם ⟦אתה|את⟧ ⟦שחקן|שחקנית⟧ שחמט.',
    links: [
      { href: '/what-is-shogi/', label: 'מה זה שוגי?', hint: 'תשובות קצרות לשאלות הראשונות', icon: 'question' },
      { href: '/chess/', label: 'לשחקני שחמט', hint: 'מה כבר מוכר, ומה חדש', icon: 'chess' },
      { href: '/history/', label: 'ההיסטוריה של השוגי', hint: 'מ־1058 ועד היום', icon: 'scroll' },
      { href: '/ranks/', label: 'דרגות בשוגי', hint: 'קיו ודאן בעולם, ומה הדרגה שלך כאן', icon: 'ranks' },
    ],
  },
  {
    label: '⟦למד|למדי⟧ לשחק',
    tour: 'learn',
    icon: 'learn',
    blurb: 'מסלול מסודר מאפס ועד בעיות מט, בעברית ובחינם.',
    links: [
      { href: '/try/', label: '⟦צפה|צפי⟧ במשחק אחד', hint: 'הצעד הראשון: מהלך אחרי מהלך, בלי ידע מוקדם', icon: 'watch' },
      { href: '/course/', label: 'מסלול לימוד אישי', hint: 'מאיפה מתחילים, ומה הצעד הבא', icon: 'course' },
      { href: '/learn/', label: 'שיעורים אינטראקטיביים', hint: 'תרגול על הלוח, בשלוש רמות', icon: 'board' },
      { href: '/learn/#level-beginner', label: 'מתחילים', sub: true },
      { href: '/learn/#level-intermediate', label: 'בינוניים', sub: true },
      { href: '/learn/#level-advanced', label: 'מתקדמים', sub: true },
      { href: '/rules/', label: 'חוקים בסיסיים', hint: 'קריאה: כל החוקים מאפס', icon: 'rules' },
      { href: '/learn/guide/', label: 'פתיחות, מבצרים ואסטרטגיה', hint: 'מה זה ולמה', icon: 'castle' },
      { href: '/tsume/', label: 'בעיות מט', hint: 'אימון לסוף המשחק: מט ב־1 עד 7 מהלכים', icon: 'king' },
    ],
  },
  {
    label: '⟦שחק|שחקי⟧',
    tour: 'play',
    icon: 'play',
    blurb: 'נגד המחשב כאן באתר, או מול שחקנים מכל העולם.',
    links: [
      { href: '/play/', label: 'נגד המחשב', hint: 'משחק מלא, ישר בדפדפן', icon: 'cpu' },
      { href: '/lishogi/', label: '⟦שחק|שחקי⟧ אונליין בליש׳וגי', hint: 'מדריך: משחקים מול כל העולם', icon: 'online' },
    ],
  },
  {
    label: 'כלים',
    icon: 'tools',
    blurb: 'שעון משחק, צפייה במשחקים שנרשמו, והאתר כאפליקציה במסך הבית.',
    links: [
      { href: '/app/', label: 'האפליקציה', hint: 'שוגי ישראל במסך הבית של הטלפון', icon: 'app' },
      { href: '/clock/', label: 'שעון משחק', hint: 'איך משחקים על זמן', icon: 'clock' },
      { href: '/kif/', label: 'רישום משחקים (KIF)', hint: 'צפייה וניתוח של משחק שנרשם', icon: 'kif' },
    ],
  },
  {
    label: 'קהילה',
    tour: 'community',
    icon: 'group',
    blurb: 'שחקנים ישראלים: איפה משחקים ומדברים.',
    links: [
      { href: '/community/', label: 'דף הקהילה', hint: 'איפה משחקים ומדברים', icon: 'group' },
      { href: WHATSAPP_URL, label: 'קהילת הוואטסאפ', external: true, icon: 'whatsapp-logo' },
      { href: INSTAGRAM_URL, label: 'אינסטגרם', external: true, icon: 'instagram-logo' },
      { href: FACEBOOK_GROUP_URL, label: 'קבוצת הפייסבוק', external: true, icon: 'facebook-logo' },
      { href: FACEBOOK_PAGE_URL, label: 'עמוד הפייסבוק', external: true, icon: 'facebook-logo' },
    ],
  },
  { href: '/about/', label: 'אודות', icon: 'about' },
];

export const ACCOUNT: NavLink = { href: '/account/', label: 'החשבון שלי', icon: 'account' };

const routes = new Set(
  Object.keys(import.meta.glob('/src/pages/**/*.{astro,md,mdx}'))
    .filter((f) => !f.includes('['))
    .map((f) => f.replace(/^\/src\/pages/, '').replace(/\.(astro|mdx?)$/, '').replace(/\/index$/, '/'))
    .map((r) => (r.endsWith('/') ? r : `${r}/`)),
);

export const isLive = (l: NavLink): boolean => l.external || l.href.includes('#') || routes.has(l.href);

export const liveNav = (): NavItem[] =>
  NAV.flatMap((i): NavItem[] => {
    if (!isSection(i)) return isLive(i) ? [i] : [];
    const links = i.links.filter(isLive);
    if (links.length === 0) return [];
    if (links.length === 1) return [{ ...links[0], label: i.label, hint: undefined }];
    return [{ ...i, links }];
  });

export const liveSections = (): NavSection[] =>
  NAV.filter(isSection)
    .map((s) => ({ ...s, links: s.links.filter((l) => isLive(l) && !l.sub) }))
    .filter((s) => s.links.length > 0);

export const withChips = (links: NavLink[]): (NavLink | NavLink[])[] =>
  links.reduce<(NavLink | NavLink[])[]>((out, l) => {
    const last = out[out.length - 1];
    if (!l.sub) out.push(l);
    else if (Array.isArray(last)) last.push(l);
    else out.push([l]);
    return out;
  }, []);

export const isCurrent = (l: NavLink, path: string): boolean =>
  !l.external && !l.href.includes('#') && (l.href === '/' ? path === '/' : path.startsWith(l.href));
