# src/learn — interactive lessons engine

Ported from **Lishogi's Learn module** ([lila `ui/learn`](https://github.com/WandererXII/lila/tree/89aea5f6f24c5e941c7cac8434a6e9e1acc15e94/ui/learn), commit `89aea5f`, 2026-10-19).
Copyright (c) 2019 onwards the li[shogi in sca]la authors. **AGPL-3.0-or-later** (see `/LICENSE`). Every copied file starts with a header naming its source and what we changed.

## What is ported, what is ours
| File | Origin | Change |
|---|---|---|
| `interfaces.ts`, `level.ts`, `assert.ts`, `shapes.ts`, `util.ts` | lila | unchanged |
| `shogi.ts` | lila | `randomNumber` inlined |
| `progress.ts` | lila | localStorage shim, no server sync |
| `ctrl.ts` | lila | our own sounds; URLs `/learn/<slug>/#<level>`; a new stage or the menu is a new history entry (browser back works) |
| `ground.ts` | lila | our lesson settings instead of user prefs; numeric coordinates |
| `categories.ts` | lila | all 18 stages, same order |
| `stages/*.ts` (18) | lila | i18n import path only; positions, goals, keys unchanged |
| `i18n.ts`, `i18n/he.json` | ours | Hebrew written from our locked glossary; **keys = Lishogi's `learn.xml` names**; `il_*` keys are ours |
| `storage.ts`, `boot.ts`, `view.ts`, `globals.d.ts` | ours | replace lila's globals, build glue and snabbdom views. `view.ts` follows lila's screens: stage map with progress and "what next", lesson with the side map and back button, the table, the start and end overlays |
| `prefs.ts` | ours | settings dialog (cog wheel): square numbers, move dots, animation, sound (+ volume, set on /account/); piece set is the site-wide switch |
| `sound.ts` | ours | every sound on the site, Web Audio: Dean's recorded piece for the board, synthesized koto, hyoshigi and rin for the rest (Lishogi's sound sets are not free) |
| `keyboard.ts` | ours | keyboard play (IS 5568): arrows, two digits jump to a square, Enter, D for the hand, +/- for promotion, live announcements in Hebrew |
| `urls.ts` | ours | `/learn/<slug>/` (stage key in kebab case: `out-of-check`) |
| `route.ts` | ours | chess-player route: `il_chess_<stage>Intro/Complete` replace a stage's intro and recap, `il_chess_<stage>Note` adds a note under it; on with `?route=chess` or the course's chess starting point |
| `impasse.ts` | ours | 27-point declaration check (shogiops has none) |

Board: [shogiground](https://github.com/WandererXII/shogiground) (GPL-3.0) with our own piece art and colours (`src/styles/learn.css`); base CSS vendored in `src/styles/shogiground.css`. Rules: [shogiops](https://github.com/WandererXII/shogiops) `~0.21` (GPL-3.0) — pinned below 0.22, which renamed the Board API that the ported code uses.

**Not reused** (not free): Lishogi's logo, dobutsu art, sound sets, piece sets.

## Adding a stage
1. Write `stages/<key>.ts` (our own stages use an `il_` key prefix) or copy one from lila with the same header, `i18n` import pointing at `../i18n`.
2. Register it in `categories.ts`. Its page (`src/pages/learn/[stage].astro`) is generated from that list.
3. Add its strings to `i18n/he.json` under the **same key names** as `translation/source/learn.xml`.
4. `bun test test/` must stay green: it solves every level with 3 stars and checks that no string is missing.

## Tests
`bun test test/`: the 27-point checker against real shogiops positions, and `stages.test.ts`, which solves all 121 levels within their target move count (3 stars) by replaying the controller's rules, and checks every string exists in `he.json`.
