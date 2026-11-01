// AGPL-3.0-or-later, like the rest of src/learn/.
import { hasKey, i18n } from './i18n';
import { readLocal } from '../lib/progress-local';

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
  } catch { }
}

export function routeFromUrl(search = window.location.search): void {
  const r = new URLSearchParams(search).get('route');
  if (r === 'chess' || r === 'main') setRoute(r);
}

export function isChessRoute(): boolean {
  const o = override();
  if (o) return o === 'chess';
  const c = readLocal().course as { route?: string; track?: string | null };
  if (c.route) return c.route === 'chess';
  return c.track === 'chess';
}

const chessKey = (stageKey: string, part: 'Intro' | 'Complete' | 'Note') => `il_chess_${stageKey}${part}`;

export const hasChessText = (stageKey: string): boolean =>
  (['Intro', 'Complete', 'Note'] as const).some((p) => hasKey(chessKey(stageKey, p)));

export function stageText(stageKey: string, part: 'Intro' | 'Complete', normal: string, chess = isChessRoute()): string {
  const k = chessKey(stageKey, part);
  return chess && hasKey(k) ? i18n(k) : normal;
}

export function chessNote(stageKey: string, chess = isChessRoute()): string | null {
  const k = chessKey(stageKey, 'Note');
  return chess && hasKey(k) ? i18n(k) : null;
}
