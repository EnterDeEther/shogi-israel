// The site-wide piece set: html[data-pieces], remembered on this device as localStorage 'pieceSet'
// (the older 'pieces' key, from before Hebrew was the default, is removed in Base.astro).
// Hebrew letters are the default; anything unknown (old or missing storage) falls back to it.
export type PieceSet = 'hebrew' | 'letters' | 'kanji';

export function pieceSetOf(v: string | null | undefined): PieceSet {
  return v === 'letters' || v === 'kanji' ? v : 'hebrew';
}

export function currentPieceSet(): PieceSet {
  return pieceSetOf(document.documentElement.dataset.pieces);
}

// The font of the Hebrew letters on the pieces: html[data-hfont], remembered on this device as localStorage 'hebrewFont'.
// Noto Serif Hebrew is the default (Dean, 28 Oct 2026); Suez One and Secular One are the other two choices.
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
