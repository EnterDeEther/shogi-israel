// What search engines and link previews read about a page, decided from its path (used by Base.astro):
// the share card (public/og/<slug>.png, made by `npm run og` from src/lib/og-cards.ts) and the JSON-LD.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { INSTAGRAM_URL } from './nav';
import { LISHOGI_TEAM } from './live';

const SITE = 'https://shogi.co.il';
const NAME = 'שוגי ישראל';

/** The page's own share card when one was made, otherwise the site card. */
export function ogImageFor(pathname: string): string {
  const slug = pathname.replace(/^\/+|\/+$/g, '').replace(/\/+/g, '-');
  return slug && existsSync(join(process.cwd(), 'public/og', `${slug}.png`)) ? `/og/${slug}.png` : '/og/default.png';
}

const org = {
  '@type': 'Organization',
  name: NAME,
  alternateName: 'Shogi Israel',
  url: `${SITE}/`,
  logo: `${SITE}/favicon-192.png`,
  sameAs: [INSTAGRAM_URL, LISHOGI_TEAM],
};

// Sections whose pages get a breadcrumb trail (section › page).
const SECTIONS: Record<string, string> = {
  rules: 'חוקים בסיסיים',
  learn: 'שיעורים אינטראקטיביים',
  tsume: 'בעיות מט',
};

/** JSON-LD for the page: the site and its publisher on the home page, the course on /rules/, breadcrumbs inside a section. */
export function structuredData(pathname: string, title: string, description: string): object[] {
  const url = new URL(pathname, SITE).href;
  if (pathname === '/') {
    return [
      { '@context': 'https://schema.org', '@type': 'WebSite', name: NAME, alternateName: ['Shogi Israel', 'shogi.co.il'], url: `${SITE}/`, inLanguage: 'he' },
      { '@context': 'https://schema.org', ...org },
    ];
  }
  if (pathname === '/rules/') {
    return [{
      '@context': 'https://schema.org', '@type': 'Course', name: title, description, url, inLanguage: 'he',
      isAccessibleForFree: true, provider: org,
      offers: { '@type': 'Offer', category: 'Free', price: 0, priceCurrency: 'ILS' },
      hasCourseInstance: { '@type': 'CourseInstance', courseMode: 'Online', courseWorkload: 'PT1H30M' },
    }];
  }
  const m = pathname.match(/^\/([a-z]+)\/[^/]+\/$/);
  if (m && SECTIONS[m[1]]) {
    return [{
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: SECTIONS[m[1]], item: `${SITE}/${m[1]}/` },
        { '@type': 'ListItem', position: 2, name: title.split(' · ')[0], item: url },
      ],
    }];
  }
  return [];
}

/** JSON for a <script type="application/ld+json">, safe inside HTML. */
export const ldJson = (data: object): string => JSON.stringify(data).replace(/</g, '\\u003c');
