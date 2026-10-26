# shogi-israel
שוגי ישראל — shogi.co.il

The Hebrew home of shogi in Israel: a free rules course and the community hub.
Astro static site, deployed by Vercel on every push to `main`.

## Adding a lesson
1. Drop the lesson's MDX file into `src/content/rules/` (file name = slug, e.g. `02-how-pieces-move.mdx`).
2. Push. Vercel builds and publishes. The lesson joins the sitemap by itself (`astro.config.mjs` keeps out only lessons whose MDX is missing).

MDX components available in lessons: `<Step>` (board beside its text), `<Board sfen highlight zones reveal caption />`, `<Task answer hint>`, `<Note title>`, `<Term id first>`, `<Notation>`, `<Piece>` (a kanji or letter inside a piece shape; use it wherever a piece label sits next to its name).

## Adding a page to the menu
The header (desktop bar and phone panel) and the footer site map are drawn from `src/lib/nav.ts`.
Add a link to the right section there. An internal link shows only once its page exists in `src/pages/`,
so a slot for a page still being built can wait in the list and appears when the page lands.
Sections: "למדו לשחק" (lessons only), "שחקו", "הכירו את השוגי" (background reading), "כלים", "קהילה". Each section's `blurb` and links also draw the "מה יש באתר" cards on the home page. A section with a single live link shows as a plain link in the menu.
Every page is in `sitemap-index.xml` unless it sets `noindex` on `<Base>`.

## Share images and search data
A page's link preview (og:image) is `public/og/<path with dashes>.png` when that file exists (`/rules/03-promotion/` → `rules-03-promotion.png`), otherwise `public/og/default.png`.
The cards are written in `src/lib/og-cards.ts` (text, seal kanji, board). After changing one, or after adding a lesson, run `npm run og` (needs Playwright's Chromium) and commit the new images.
JSON-LD (site name on the home page, the course on `/rules/`, breadcrumbs inside `/rules/`, `/learn/` and `/tsume/`) comes from `src/lib/seo.ts`.

## Design rules (Direction A, "נייר ודיו")
- Page is `dir="rtl"`; **the board is always `dir="ltr"` and never mirrors** (file 9 left, file 1 right, rank 1 top).
- Pieces: English letters by default, kanji via the switch above any board (one site-wide setting, saved on the device).
- Squares are two digits (`76`), moves `P-76`; always inside `<bdi dir="ltr">`.
- Type: Frank Ruhl Libre (display), Heebo (body), Shippori Mincho (kanji). Self-hosted via Fontsource, OFL.
- Accessibility target: IS 5568 AA (built to WCAG 2.1 AA). Every board has a text description; tasks work by keyboard.
- Privacy: no cookies. Vercel Web Analytics only (cookieless). The only forms are the contact form (below) and the optional account sign-up (see Accounts below); `/privacy/` says what each collects.

## Contact
Email [contact@shogi.co.il](mailto:contact@shogi.co.il), or Instagram [@shogi.israel](https://www.instagram.com/shogi.israel/).
The address lives in `CONTACT_EMAIL` in `src/lib/contact.ts` (re-exported from `src/lib/nav.ts`). Security issues: see `SECURITY.md`.

The contact form on `/about/#contact` (`src/components/ContactForm.astro`) posts to the Vercel Function `api/contact.ts`,
which checks the fields (`src/lib/contact.ts`) and emails them to `CONTACT_EMAIL` through Resend, with Reply-To set to the sender.
It needs `RESEND_API_KEY` in the Vercel project's environment variables (a Resend key with sending access for shogi.co.il).
Without it the form answers with an error and links to the email address.

## Local dev
```
npm install
npm run dev
```

## Interactive lessons (`/learn/`)
Engine ported from Lishogi's Learn module; details and file-by-file changes in `src/learn/README.md`.

Credit (also on the site's credits page):
- מערכת השיעורים האינטראקטיבית מבוססת על הקוד ועל מבנה הלימוד של Lishogi (lishogi.org), תוכנה חופשית ברישיון AGPL-3.0. השינויים שלנו, כולל הטקסטים בעברית, פתוחים באותו רישיון ב-github.com/EnterDeEther/shogi-israel. תודה לצוות Lishogi.
- The interactive lessons are adapted from the code and lesson structure of Lishogi (lishogi.org), free software under AGPL-3.0. Our changes, including the Hebrew text, are published under the same licence at github.com/EnterDeEther/shogi-israel. Thanks to the Lishogi team. Board and rules: shogiground and shogiops (GPL-3.0).

## Accounts (`/account/`)
Optional accounts on Supabase: email + password (confirmed by email; no Google/SSO), a public nickname, and progress that follows the account. Off until the keys exist: without them the site builds exactly as before, with no account link.
- Keys: the Vercel ↔ Supabase integration sets `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or set `PUBLIC_SUPABASE_URL` / `PUBLIC_SUPABASE_ANON_KEY`).
- Database: run `supabase/migrations/0001_accounts.sql` once (tables `profiles`, `progress`, `games`, with row-level security, and `delete_my_account()`), then `0002_community_counts.sql` (the totals on `/community/`; counts only, callable signed out), then `0004_profiles_public_columns.sql` (signed-out visitors see only nicknames and ratings). `supabase/tests/rls.sql` checks the rules.
- Supabase settings: Authentication → URL configuration: Site URL `https://shogi.co.il`, redirect URLs `https://shogi.co.il/account/` and `https://*-enterdeether.vercel.app/account/`. Emails: paste `supabase/templates/confirm-signup.html` and `reset-password.html` into those two templates. Password minimum length 8. Before launch, set a custom SMTP sender: Supabase's built-in one sends only a few emails an hour.
- Code: `src/lib/account-config.ts` (is it on), `src/lib/account.ts` (client, sign-in, sync), `src/lib/progress-sync.ts` (merge rules, tested). Lessons and the rules course fire `progress-changed` / `progress-reset`; the sync merges (best score per level, union of finished lessons) and fires `progress-synced`.
- Play vs AI: `syncGames()` sends the device's finished games (`shogi-il.play.history`) to `games` after each `shogi-il:game-end` and on sign-in, deduped by the game's id; the account page counts them. `profiles.rating` is server-only, for future leaderboards.

## Security
- Every page carries a Content-Security-Policy `<meta>` (Astro `security.csp` in `astro.config.mjs`): scripts only from this site (inline ones pinned by hash), network only to this site and Supabase, no plugins, no foreign forms. `vercel.json` adds HSTS, no framing (clickjacking), nosniff, a strict referrer and a closed Permissions-Policy.
- Accounts: row-level security on every table; people read and change only their own rows, and only the columns they should (rating is server-only). `supabase/tests/rls.sql` checks this against the real database (run as postgres; it rolls back). Run it after every migration.
- Bots: Cloudflare Turnstile on sign-up, sign-in and password reset (site key in `src/lib/account-config.ts`, overridable with `PUBLIC_TURNSTILE_SITE_KEY`) (the secret key lives only in Supabase → Attack Protection).
- Secrets: only the public Supabase URL and anon key (and the public Turnstile site key) reach the browser. The service-role key and database URL stay in Vercel env and are never imported by site code.

## KIF game records (`/kif/`)
`src/lib/kif.ts` is the one KIF module for the site: `makeKif()` writes a game (start SFEN + USI moves) as a
Lishogi-compatible UTF-8 KIF, `parseKif()` reads one back (Shift_JIS files too, via `readKifFile()`), plus
`downloadKif()`, `copyText()` and `LISHOGI_IMPORT_URL`. Any page that plays a game should export through it.
`/kif/` is the Hebrew guide to the format with a KIF viewer (`src/components/KifViewer.astro`). Tests: `test/kif.test.ts`.
