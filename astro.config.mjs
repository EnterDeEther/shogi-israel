import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { readdirSync } from 'node:fs';

const liveLessons = new Set(readdirSync(new URL('./src/content/rules', import.meta.url)).map((f) => f.replace(/\.mdx?$/, '')));
const isDraftLesson = (page) => {
  const m = page.match(/\/rules\/(\d\d-[^/]+)\/?$/);
  return m !== null && !liveLessons.has(m[1]);
};

const LIVE_DB = 'idcckcvrjoxwqvwtyccc.supabase.co';
const dbHost = (() => {
  try { return new URL(process.env.PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').host || LIVE_DB; } catch { return LIVE_DB; }
})();
const dbHosts = [...new Set([LIVE_DB, dbHost])].filter((h) => !h.startsWith('localhost'));
const connectSrc = ["'self'", ...dbHosts.flatMap((h) => [`https://${h}`, `wss://${h}`])].join(' ');

const isolation = { 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp' };

export default defineConfig({
  site: 'https://shogi.co.il',
  trailingSlash: 'ignore',
  integrations: [
    mdx(),
    sitemap({ filter: (page) => !isDraftLesson(page) && !/\/(account|app|settings|tsume\/week|friend|games)\//.test(page) }),
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
        `connect-src ${connectSrc}`,
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
