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
Everything that teaches the game goes under "למד לשחק". A section with a single live link shows as a plain link.
Every page is in `sitemap-index.xml` unless it sets `noindex` on `<Base>`.

## Design rules (Direction A, "נייר ודיו")
- Page is `dir="rtl"`; **the board is always `dir="ltr"` and never mirrors** (file 9 left, file 1 right, rank 1 top).
- Pieces: English letters by default, kanji via the switch above any board (one site-wide setting, saved on the device).
- Squares are two digits (`76`), moves `P-76`; always inside `<bdi dir="ltr">`.
- Type: Frank Ruhl Libre (display), Heebo (body), Shippori Mincho (kanji). Self-hosted via Fontsource, OFL.
- Accessibility target: IS 5568 AA (built to WCAG 2.1 AA). Every board has a text description; tasks work by keyboard.
- Privacy: no cookies. Vercel Web Analytics only (cookieless). The one form is the contact form (below); `/privacy/` says what it collects.

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

## KIF game records (`/kif/`)
`src/lib/kif.ts` is the one KIF module for the site: `makeKif()` writes a game (start SFEN + USI moves) as a
Lishogi-compatible UTF-8 KIF, `parseKif()` reads one back (Shift_JIS files too, via `readKifFile()`), plus
`downloadKif()`, `copyText()` and `LISHOGI_IMPORT_URL`. Any page that plays a game should export through it.
`/kif/` is the Hebrew guide to the format with a KIF viewer (`src/components/KifViewer.astro`). Tests: `test/kif.test.ts`.
