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
- Privacy: no cookies, no forms. Vercel Web Analytics only (cookieless).

## Local dev
```
npm install
npm run dev
```
