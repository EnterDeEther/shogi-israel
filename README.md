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
- Privacy: no cookies, no forms. Vercel Web Analytics only (cookieless).

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
