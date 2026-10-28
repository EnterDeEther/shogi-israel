// What search engines and link previews read about a page, decided from its path (used by Base.astro):
// the share card (public/og/<slug>.png, made by `npm run og` from src/lib/og-cards.ts) and the JSON-LD.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { INSTAGRAM_URL } from './nav';
import { LISHOGI_TEAM } from './live';
import { FAQ, plainAnswer } from './shogi-faq';

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
  logo: `${SITE}/logo-512.png`,
  description: 'הקהילה הישראלית של השוגי, השחמט היפני: שיעורים, בעיות מט ומשחק נגד המחשב, בעברית ובחינם.',
  areaServed: { '@type': 'Country', name: 'Israel' },
  knowsAbout: ['שוגי', 'Shogi', 'Japanese chess', 'Tsume shogi'],
  sameAs: [INSTAGRAM_URL, LISHOGI_TEAM],
};

// The game itself, so search engines and AI tools tie our pages to the right "shogi".
const shogi = { '@type': 'Thing', name: 'Shogi', alternateName: ['שוגי', '将棋', 'Japanese chess'], sameAs: 'https://en.wikipedia.org/wiki/Shogi' };

// Section pages that teach: an interactive stage or a rules lesson.
const RESOURCE: Record<string, string> = { learn: 'Interactive exercise', rules: 'Lesson' };

// Sections whose pages get a breadcrumb trail (section › page).
const SECTIONS: Record<string, string> = {
  rules: 'חוקים בסיסיים',
  learn: 'שיעורים אינטראקטיביים',
  tsume: 'בעיות מט',
};

/** JSON-LD for the page: the site and its publisher on the home page, the course on /rules/, questions and answers on
 *  /what-is-shogi/, and inside a section breadcrumbs, plus a free Hebrew learning resource for each lesson. */
export function structuredData(pathname: string, title: string, description: string): object[] {
  const url = new URL(pathname, SITE).href;
  if (pathname === '/') {
    return [
      { '@context': 'https://schema.org', '@type': 'WebSite', name: NAME, alternateName: ['Shogi Israel', 'shogi.co.il'], url: `${SITE}/`, inLanguage: 'he', description, about: shogi },
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
  if (pathname === '/what-is-shogi/') {
    return [{
      '@context': 'https://schema.org', '@type': 'FAQPage', url, inLanguage: 'he', about: shogi,
      mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: plainAnswer(f.a) } })),
    }];
  }
  const m = pathname.match(/^\/([a-z]+)\/[^/]+\/$/);
  if (m && SECTIONS[m[1]]) {
    const name = title.split(' · ')[0];
    const resource = RESOURCE[m[1]] && pathname !== '/learn/guide/' && {
      '@context': 'https://schema.org', '@type': 'LearningResource', name, description, url, inLanguage: 'he',
      learningResourceType: RESOURCE[m[1]], isAccessibleForFree: true, about: shogi, provider: org,
      isPartOf: { '@type': m[1] === 'rules' ? 'Course' : 'CreativeWork', name: SECTIONS[m[1]], url: `${SITE}/${m[1]}/` },
    };
    return [...(resource ? [resource] : []), {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: SECTIONS[m[1]], item: `${SITE}/${m[1]}/` },
        { '@type': 'ListItem', position: 2, name, item: url },
      ],
    }];
  }
  return [];
}

/** JSON for a <script type="application/ld+json">, safe inside HTML. */
export const ldJson = (data: object): string => JSON.stringify(data).replace(/</g, '\\u003c');
