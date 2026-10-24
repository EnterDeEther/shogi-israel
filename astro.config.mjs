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
    // /learn/ stays out until the tech chat removes noindex from those pages.
    sitemap({ filter: (page) => !/\/rules\/0[3-8]-/.test(page) && !/\/learn\//.test(page) && !/\/account\//.test(page) }),
  ],
  // Stylesheets as files, so the CSP needs no style hashes (hashes would switch 'unsafe-inline' off).
  build: { format: 'directory', inlineStylesheets: 'never' },
  // The Vercel ↔ Supabase integration names its public keys NEXT_PUBLIC_*; expose those to the browser too.
  vite: { envPrefix: ['PUBLIC_', 'NEXT_PUBLIC_'] },
  // Content-Security-Policy as a <meta> tag on every page: only our own scripts (inline ones by hash) may run,
  // and the browser may talk only to us and to Supabase. Headers that a <meta> can't set live in vercel.json.
  security: {
    csp: {
      directives: [
        "default-src 'self'",
        "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
        "img-src 'self' data: blob:",
        "font-src 'self' data:",
        "media-src 'self'",
        // Cloudflare Turnstile: the bot check on the account forms
        "frame-src https://challenges.cloudflare.com",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "upgrade-insecure-requests",
      ],
      // Boards and the lesson player set style="" attributes; styles can't run code, so allow them.
      styleDirective: { resources: ["'self'", "'unsafe-inline'"] },
      scriptDirective: { resources: ["'self'", 'https://challenges.cloudflare.com'] },
    },
  },
});
