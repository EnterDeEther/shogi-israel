// The site menu, in one place. Header (desktop and phone) and footer are drawn from this list.
//
// Adding a page: add a link to the right section below. An internal link only shows once its page
// exists in src/pages/ (see isLive), so a slot for a page that is still being built can sit here
// already and appears by itself when the page lands. Links with a #hash are always shown.
// Everything that teaches the game goes under "למד לשחק".

export interface NavLink {
  href: string;
  label: string;
  /** One short line under the label in the phone menu and the desktop dropdown. */
  hint?: string;
  external?: boolean;
  /** A topic inside the link before it: drawn as a small chip on phones, indented on desktop. */
  sub?: boolean;
}
export interface NavSection {
  label: string;
  links: NavLink[];
}
/** A top-level entry: a section (a dropdown on desktop, a heading on phones) or a single link. */
export type NavItem = NavSection | NavLink;
export const isSection = (i: NavItem): i is NavSection => 'links' in i;

export const WHATSAPP_URL = 'https://chat.whatsapp.com/Hl05iCdO2OY1rJIETuAien';
export const INSTAGRAM_URL = 'https://www.instagram.com/shogi.israel/';
export { CONTACT_EMAIL } from './contact';

export const NAV: NavItem[] = [
  {
    label: 'למד לשחק',
    links: [
      { href: '/rules/', label: 'קורס החוקים', hint: 'מאפס, צעד אחר צעד' },
      { href: '/learn/', label: 'שיעורים אינטראקטיביים', hint: 'תרגול על הלוח' },
      { href: '/learn/#cat-openings', label: 'פתיחות', sub: true },
      { href: '/learn/#cat-castles', label: 'מבצרים', sub: true },
      { href: '/learn/#cat-strategy', label: 'אסטרטגיה', sub: true },
      { href: '/chess/', label: 'לשחקני שחמט', hint: 'מה כבר מוכר, ומה חדש' },
      { href: '/lishogi/', label: 'המדריך לליש׳וגי', hint: 'לשחק אונליין מול כל העולם' },
      { href: '/kif/', label: 'רישום משחקים (KIF)' },
      { href: '/clock/', label: 'משחק על זמן', hint: 'איך השעון עובד' },
    ],
  },
  {
    label: 'שחקו',
    links: [
      { href: '/play/', label: 'נגד המחשב', hint: 'משחק מלא, ישר בדפדפן' },
    ],
  },
  {
    label: 'קהילה',
    links: [
      { href: '/#community', label: 'משחקים עם ישראלים' },
      { href: WHATSAPP_URL, label: 'קהילת הוואטסאפ', external: true },
      { href: INSTAGRAM_URL, label: 'אינסטגרם', external: true },
    ],
  },
  { href: '/about/', label: 'אודות' },
];

/** The account link sits apart, at the end of the bar. Shows once /account/ exists. */
export const ACCOUNT: NavLink = { href: '/account/', label: 'החשבון שלי' };

// Routes that exist, from the files in src/pages/ ("/src/pages/play/index.astro" -> "/play/").
const routes = new Set(
  Object.keys(import.meta.glob('/src/pages/**/*.{astro,md,mdx}'))
    .filter((f) => !f.includes('['))
    .map((f) => f.replace(/^\/src\/pages/, '').replace(/\.(astro|mdx?)$/, '').replace(/\/index$/, '/'))
    .map((r) => (r.endsWith('/') ? r : `${r}/`)),
);

export const isLive = (l: NavLink): boolean => l.external || l.href.includes('#') || routes.has(l.href);

/**
 * The menu as it should show right now. Links whose page does not exist yet drop out, a section
 * left empty drops out, and a section left with one link becomes that link under the section's
 * name (so "שחקו" is a plain link until it has a second page).
 */
export const liveNav = (): NavItem[] =>
  NAV.flatMap((i): NavItem[] => {
    if (!isSection(i)) return isLive(i) ? [i] : [];
    const links = i.links.filter(isLive);
    if (links.length === 0) return [];
    if (links.length === 1) return [{ ...links[0], label: i.label, hint: undefined }];
    return [{ ...i, links }];
  });

/** Groups each run of sub links into one array, so a view can draw them as a row of chips. */
export const withChips = (links: NavLink[]): (NavLink | NavLink[])[] =>
  links.reduce<(NavLink | NavLink[])[]>((out, l) => {
    const last = out[out.length - 1];
    if (!l.sub) out.push(l);
    else if (Array.isArray(last)) last.push(l);
    else out.push([l]);
    return out;
  }, []);

/** Is this link the page we are on? (hash links never are, so a section is not lit twice) */
export const isCurrent = (l: NavLink, path: string): boolean =>
  !l.external && !l.href.includes('#') && (l.href === '/' ? path === '/' : path.startsWith(l.href));
