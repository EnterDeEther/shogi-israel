// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://shogi.co.il',
  trailingSlash: 'ignore',
  integrations: [
    mdx(),
    // Lessons still being written render an "on its way" page; keep them out of the sitemap.
    // When a lesson's MDX lands in src/content/rules/, remove its number from this list.
    sitemap({ filter: (page) => !/\/rules\/0[3-8]-/.test(page) }),
  ],
  build: { format: 'directory' },
});
