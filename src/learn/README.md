# src/learn — interactive lessons engine

Ported from **Lishogi's Learn module** ([lila `ui/learn`](https://github.com/WandererXII/lila/tree/89aea5f6f24c5e941c7cac8434a6e9e1acc15e94/ui/learn), commit `89aea5f`, 2026-10-19).
Copyright (c) 2019 onwards the li[shogi in sca]la authors. **AGPL-3.0-or-later** (see `/LICENSE`). Every copied file starts with a header naming its source and what we changed.

## What is ported, what is ours
| File | Origin | Change |
|---|---|---|
| `interfaces.ts`, `level.ts`, `assert.ts`, `shapes.ts`, `util.ts` | lila | unchanged |
| `shogi.ts` | lila | `randomNumber` inlined |
| `progress.ts` | lila | localStorage shim, no server sync |
| `ctrl.ts` | lila | no sounds; URLs `/learn/<stage>/#<level>` |
| `ground.ts` | lila | fixed settings instead of user prefs; numeric coordinates |
| `categories.ts` | lila | spike: only `silver` registered |
| `stages/silver.ts` | lila | i18n import path only; positions, goals, keys unchanged |
| `i18n.ts`, `i18n/he.json` | ours | Hebrew written from our locked glossary; **keys = Lishogi's `learn.xml` names**; `il_*` keys are ours |
| `storage.ts`, `boot.ts`, `view.ts`, `globals.d.ts` | ours | replace lila's globals, build glue and snabbdom views |
| `impasse.ts` | ours | 27-point declaration check (shogiops has none) |

Board: [shogiground](https://github.com/WandererXII/shogiground) (GPL-3.0) with our own piece art and colours (`src/styles/learn.css`); base CSS vendored in `src/styles/shogiground.css`. Rules: [shogiops](https://github.com/WandererXII/shogiops) `~0.21` (GPL-3.0) — pinned below 0.22, which renamed the Board API that the ported code uses.

**Not reused** (not free): Lishogi's logo, dobutsu art, sound sets, piece sets.

## Adding a stage
1. Copy `ui/learn/src/stages/<key>.ts` from lila with the same header, point the `i18n` import at `../i18n`.
2. Register it in `categories.ts`.
3. Add its strings to `i18n/he.json` under the **same key names** as `translation/source/learn.xml`.
4. Add `src/pages/learn/<key>.astro` with `<LearnStage stage="<key>" />`.

## Tests
`bun test test/` — the 27-point checker against real shogiops positions.
