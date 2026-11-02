export type PieceSet = 'hebrew' | 'chess' | 'letters' | 'kanji';

export const PIECE_SET_KEY = 'pieceSet';

export function pieceSetOf(v: string | null | undefined): PieceSet {
  return v === 'chess' || v === 'letters' || v === 'kanji' ? v : 'hebrew';
}

export function currentPieceSet(): PieceSet {
  return pieceSetOf(document.documentElement.dataset.pieces);
}

export function savedPieceSet(): PieceSet | null {
  try {
    const v = localStorage.getItem(PIECE_SET_KEY);
    return v ? pieceSetOf(v) : null;
  } catch {
    return null;
  }
}

export const CHESS_HINT_KEY = 'pieceSetHint';

export function routeOf(): 'chess' | 'main' | null {
  try {
    const r = localStorage.getItem('learnRoute');
    if (r === 'chess' || r === 'main') return r;
    const c = JSON.parse(localStorage.getItem('shogi-il.course') || 'null') as { route?: string; track?: string } | null;
    if (c?.route === 'chess' || c?.route === 'main') return c.route;
    if (c?.track) return c.track === 'chess' ? 'chess' : 'main';
  } catch {}
  return null;
}

export function defaultPieceSet(): PieceSet {
  const route = routeOf();
  if (route) return route === 'chess' ? 'chess' : 'hebrew';
  let hint: string | null = null;
  try { hint = localStorage.getItem(CHESS_HINT_KEY); } catch {}
  return hint === 'chess' || document.documentElement.dataset.piecesDefault === 'chess' ? 'chess' : 'hebrew';
}

export function markChessPlayer(): void {
  try { localStorage.setItem(CHESS_HINT_KEY, 'chess'); } catch {}
  refreshPieceSet();
}

export function applyPieceSet(set: PieceSet): void {
  const root = document.documentElement;
  const before = currentPieceSet();
  root.setAttribute('data-pieces', set);
  if (set !== before) document.dispatchEvent(new CustomEvent('pieces-changed', { detail: set }));
}

export function choosePieceSet(set: PieceSet): void {
  try { localStorage.setItem(PIECE_SET_KEY, set); } catch {}
  applyPieceSet(set);
}

export function refreshPieceSet(): void {
  applyPieceSet(savedPieceSet() ?? defaultPieceSet());
}

export type HebrewFont = 'noto' | 'suez' | 'secular';

export const HEBREW_FONTS: { id: HebrewFont; label: string }[] = [
  { id: 'noto', label: 'נוטו סריף' },
  { id: 'suez', label: 'סואץ' },
  { id: 'secular', label: 'סקולר' },
];

export function hebrewFontOf(v: string | null | undefined): HebrewFont {
  return v === 'suez' || v === 'secular' ? v : 'noto';
}

export function currentHebrewFont(): HebrewFont {
  return hebrewFontOf(document.documentElement.dataset.hfont);
}
