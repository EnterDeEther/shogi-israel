export type PieceSet = 'hebrew' | 'letters' | 'kanji';

export function pieceSetOf(v: string | null | undefined): PieceSet {
  return v === 'letters' || v === 'kanji' ? v : 'hebrew';
}

export function currentPieceSet(): PieceSet {
  return pieceSetOf(document.documentElement.dataset.pieces);
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
