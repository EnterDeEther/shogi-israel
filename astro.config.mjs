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

const isolation = { 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp' };

export default defineConfig({
  site: 'https://shogi.co.il',
  trailingSlash: 'ignore',
  integrations: [
    mdx(),
    // Pages with noindex stay out too: /account/ and /tsume/week/ (a hop to this week's puzzle).
    sitemap({ filter: (page) => !isDraftLesson(page) && !/\/(account|tsume\/week)\//.test(page) }),
  ],
  // Stylesheets as files, so the CSP needs no style hashes (hashes would switch 'unsafe-inline' off).
  build: { format: 'directory', inlineStylesheets: 'never' },
  vite: {
    // The Vercel ↔ Supabase integration can name its public keys NEXT_PUBLIC_*; expose those to the browser too.
    envPrefix: ['PUBLIC_', 'NEXT_PUBLIC_'],
    // The play page's engines need SharedArrayBuffer (cross-origin isolation). Production sets these headers
    // per route in vercel.json; the dev and preview servers set them everywhere.
    server: { headers: isolation },
    preview: { headers: isolation },
  },
  // Content-Security-Policy as a <meta> tag on every page: only our own scripts (inline ones by hash) may run,
  // and the browser may talk only to us and to Supabase. Headers that a <meta> can't set live in vercel.json.
  security: {
    csp: {
      directives: [
        "default-src 'self'",
        // only our own Supabase project, not any *.supabase.co, so a script can't send data to someone else's
        "connect-src 'self' https://idcckcvrjoxwqvwtyccc.supabase.co wss://idcckcvrjoxwqvwtyccc.supabase.co",
        "img-src 'self' data: blob:",
        "font-src 'self' data:",
        "media-src 'self'",
        // the play page's engines run in workers
        "worker-src 'self' blob:",
        // Cloudflare Turnstile: the bot check on the account forms
        "frame-src https://challenges.cloudflare.com",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "upgrade-insecure-requests",
      ],
      // Boards and the lesson player set style="" attributes; styles can't run code, so allow them.
      styleDirective: { resources: ["'self'", "'unsafe-inline'"] },
      // 'wasm-unsafe-eval' lets the engines compile WebAssembly; it does not allow eval() of JavaScript.
      scriptDirective: { resources: ["'self'", "'wasm-unsafe-eval'", 'https://challenges.cloudflare.com'] },
    },
  },
});
