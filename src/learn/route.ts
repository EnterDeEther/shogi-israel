// Shogi Israel: the chess-player route of the course. Chess players see a chess version of each beginner
// stage's intro and recap ("in chess... in shogi..."), and a chess note on the openings, castles and piece value.
// Strings: il_chess_<stageKey>Intro / il_chess_<stageKey>Complete replace the stage's own text;
// il_chess_<stageKey>Note is added under the intro. A stage without them shows its normal text.
// AGPL-3.0-or-later, like the rest of src/learn/.
import { hasKey, i18n } from './i18n';
import { readLocal } from '../lib/progress-local';

/** This device's explicit choice: set by a /learn/ link with ?route=chess (the /chess/ page) or ?route=main, and by the switch on the stage intro. */
export const ROUTE_KEY = 'learnRoute';

type Route = 'chess' | 'main';

function override(): Route | null {
  try {
    const v = localStorage.getItem(ROUTE_KEY);
    return v === 'chess' || v === 'main' ? v : null;
  } catch {
    return null;
  }
}

export function setRoute(route: Route | null): void {
  try {
    if (route) localStorage.setItem(ROUTE_KEY, route);
    else localStorage.removeItem(ROUTE_KEY);
  } catch { /* no storage: the default stays */ }
}

/** Reads ?route=chess / ?route=main from the address once, when a Learn page loads. */
export function routeFromUrl(search = window.location.search): void {
  const r = new URLSearchParams(search).get('route');
  if (r === 'chess' || r === 'main') setRoute(r);
}

/** The switch on this device wins; otherwise the course's starting point (route, or the older track). */
export function isChessRoute(): boolean {
  const o = override();
  if (o) return o === 'chess';
  const c = readLocal().course as { route?: string; track?: string | null };
  if (c.route) return c.route === 'chess';
  return c.track === 'chess';
}

const chessKey = (stageKey: string, part: 'Intro' | 'Complete' | 'Note') => `il_chess_${stageKey}${part}`;

/** Does this stage have any chess-player text? */
export const hasChessText = (stageKey: string): boolean =>
  (['Intro', 'Complete', 'Note'] as const).some((p) => hasKey(chessKey(stageKey, p)));

/** The intro or recap to show: the chess version on the chess route when there is one. */
export function stageText(stageKey: string, part: 'Intro' | 'Complete', normal: string, chess = isChessRoute()): string {
  const k = chessKey(stageKey, part);
  return chess && hasKey(k) ? i18n(k) : normal;
}

/** The chess note under an intro (openings, castles, piece value), or null. */
export function chessNote(stageKey: string, chess = isChessRoute()): string | null {
  const k = chessKey(stageKey, 'Note');
  return chess && hasKey(k) ? i18n(k) : null;
}
