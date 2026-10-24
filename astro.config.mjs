// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

const isolation = { 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp' };

export default defineConfig({
  site: 'https://shogi.co.il',
  trailingSlash: 'ignore',
  integrations: [
    mdx(),
    // Lessons still being written render an "on its way" page; keep them out of the sitemap.
    // When a lesson's MDX lands in src/content/rules/, remove its number from this list.
    // /learn/ and /play/ stay out until their noindex is removed.
    sitemap({ filter: (page) => !/\/rules\/0[3-8]-/.test(page) && !/\/(learn|play)\//.test(page) }),
  ],
  build: { format: 'directory' },
  // The play page's engines need SharedArrayBuffer (cross-origin isolation). Production sets these headers
  // per route in vercel.json; the dev and preview servers set them everywhere.
  vite: {
    server: { headers: isolation },
    preview: { headers: isolation },
  },
});
