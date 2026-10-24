# shogi-israel
שוגי ישראל — shogi.co.il

The Hebrew home of shogi in Israel: a free rules course and the community hub.
Astro static site, deployed by Vercel on every push to `main`.

## Adding a lesson
1. Drop the Content chat's MDX file into `src/content/rules/` (file name = slug, e.g. `02-how-pieces-move.mdx`).
2. Remove its number from the sitemap filter in `astro.config.mjs`.
3. Push. Vercel builds and publishes.

MDX components available in lessons: `<Step>` (board beside its text), `<Board sfen highlight zones reveal caption />`, `<Task answer hint>`, `<Note title>`, `<Term id first>`, `<Notation>`, `<Piece>` (a kanji or letter inside a piece shape; use it wherever a piece label sits next to its name).

## Design rules (Direction A, "נייר ודיו")
- Page is `dir="rtl"`; **the board is always `dir="ltr"` and never mirrors** (file 9 left, file 1 right, rank 1 top).
- Pieces: English letters by default, kanji via the switch above any board (one site-wide setting, saved on the device).
- Squares are two digits (`76`), moves `P-76`; always inside `<bdi dir="ltr">`.
- Type: Frank Ruhl Libre (display), Heebo (body), Shippori Mincho (kanji). Self-hosted via Fontsource, OFL.
- Accessibility target: IS 5568 AA (built to WCAG 2.1 AA). Every board has a text description; tasks work by keyboard.
- Privacy: no cookies, no ad trackers. Vercel Web Analytics only (cookieless). Accounts are optional (see below).

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
Optional accounts on Supabase: sign-in by one-time email code (or Google), a public nickname, and progress that follows the account. Off until the keys exist: without them the site builds exactly as before, with no account link.
- Keys: the Vercel ↔ Supabase integration sets `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or set `PUBLIC_SUPABASE_URL` / `PUBLIC_SUPABASE_ANON_KEY`). `PUBLIC_AUTH_GOOGLE=1` shows the Google button once that provider is on.
- Database: run `supabase/migrations/0001_accounts.sql` once (tables `profiles`, `progress`, `games`, with row-level security, and `delete_my_account()`).
- Supabase settings: Authentication → URL configuration: Site URL `https://shogi.co.il`, redirect URLs `https://shogi.co.il/account/` and `https://*-enterdeether.vercel.app/account/`. Emails: paste `supabase/templates/magic-link.html` into "Magic link" and "Confirm signup" (it shows the 6-digit code). Before launch, set a custom SMTP sender: Supabase's built-in one sends only a few emails an hour.
- Code: `src/lib/account-config.ts` (is it on), `src/lib/account.ts` (client, sign-in, sync), `src/lib/progress-sync.ts` (merge rules, tested). Lessons and the rules course fire `progress-changed` / `progress-reset`; the sync merges (best score per level, union of finished lessons) and fires `progress-synced`.
- Play vs AI: insert a row into `games` after each finished game (`opponent: 'ai'`, `level`, `color`, `result`, `moves`, `kif`); the account page counts them. `profiles.rating` is server-only, for future leaderboards.
