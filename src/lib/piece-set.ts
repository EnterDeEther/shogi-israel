// The site-wide piece set: html[data-pieces], remembered on this device as localStorage 'pieces'.
// Hebrew letters are the default; anything unknown (old or missing storage) falls back to it.
export type PieceSet = 'hebrew' | 'letters' | 'kanji';

export function pieceSetOf(v: string | null | undefined): PieceSet {
  return v === 'letters' || v === 'kanji' ? v : 'hebrew';
}

export function currentPieceSet(): PieceSet {
  return pieceSetOf(document.documentElement.dataset.pieces);
}
