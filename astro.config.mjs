// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { readdirSync } from 'node:fs';

// A Rules lesson is live once its MDX is in src/content/rules/; the others render an "on its way"
// page with noindex, so they stay out of the sitemap. Nothing to edit here when a lesson lands.
const liveLessons = new Set(readdirSync(new URL('./src/content/rules', import.meta.url)).map((f) => f.replace(/\.mdx?$/, '')));
const isDraftLesson = (page) => {
  const m = page.match(/\/rules\/(\d\d-[^/]+)\/?$/);
  return m !== null && !liveLessons.has(m[1]);
};

export default defineConfig({
  site: 'https://shogi.co.il',
  trailingSlash: 'ignore',
  integrations: [
    mdx(),
    sitemap({ filter: (page) => !isDraftLesson(page) }),
  ],
  build: { format: 'directory' },
});
