import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { readdirSync } from 'node:fs';

const liveLessons = new Set(readdirSync(new URL('./src/content/rules', import.meta.url)).map((f) => f.replace(/\.mdx?$/, '')));
const isDraftLesson = (page) => {
  const m = page.match(/\/rules\/(\d\d-[^/]+)\/?$/);
  return m !== null && !liveLessons.has(m[1]);
};

const isolation = { 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp' };

export default defineConfig({
  site: 'https://shogi.co.il',
  trailingSlash: 'ignore',
  integrations: [
    mdx(),
    sitemap({ filter: (page) => !isDraftLesson(page) && !/\/(account|app|tsume\/week)\//.test(page) }),
  ],
  build: { format: 'directory', inlineStylesheets: 'never' },
  vite: {
    envPrefix: ['PUBLIC_', 'NEXT_PUBLIC_'],
    server: { headers: isolation },
    preview: { headers: isolation },
  },
  security: {
    csp: {
      directives: [
        "default-src 'self'",
        "connect-src 'self' https://idcckcvrjoxwqvwtyccc.supabase.co wss://idcckcvrjoxwqvwtyccc.supabase.co",
        "img-src 'self' data: blob:",
        "font-src 'self' data:",
        "media-src 'self'",
        "worker-src 'self' blob:",
        "frame-src https://challenges.cloudflare.com",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "upgrade-insecure-requests",
      ],
      styleDirective: { resources: ["'self'", "'unsafe-inline'"] },
      scriptDirective: { resources: ["'self'", "'wasm-unsafe-eval'", 'https://challenges.cloudflare.com'] },
    },
  },
});
