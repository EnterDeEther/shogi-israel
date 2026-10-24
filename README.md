# shogi-israel
שוגי ישראל — shogi.co.il

The Hebrew home of shogi in Israel: a free rules course and the community hub.
Astro static site, deployed by Vercel on every push to `main`.

## Adding a lesson
1. Drop the Content chat's MDX file into `src/content/rules/` (file name = slug, e.g. `02-how-pieces-move.mdx`).
2. Remove its number from the sitemap filter in `astro.config.mjs`.
3. Push. Vercel builds and publishes.

MDX components available in lessons: `<Board sfen highlight zones caption />`, `<Task answer>`, `<Note title>`, `<Term id first>`, `<Notation>`.

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
