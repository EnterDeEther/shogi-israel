// SFEN parsing + Hebrew text alternatives for boards.
// Squares are named file+rank, two digits (76 = file 7, rank 6), per the project notation rule.
// The board is never mirrored: file 9 is on the left, file 1 on the right, rank 1 at the top.

export type Side = 'sente' | 'gote';
export type PieceType = 'K' | 'R' | 'B' | 'G' | 'S' | 'N' | 'L' | 'P';

export interface Piece {
  type: PieceType;
  side: Side;
  promoted: boolean;
}

export interface Square {
  file: number; // 9..1
  rank: number; // 1..9
  id: string; // "76"
  piece: Piece | null;
}

export interface Position {
  squares: Square[]; // row-major: rank 1 first, file 9 → 1 within a rank
  hands: Record<Side, Partial<Record<PieceType, number>>>;
  turn: Side;
}

export const LETTER: Record<PieceType, string> = { K: 'K', R: 'R', B: 'B', G: 'G', S: 'S', N: 'N', L: 'L', P: 'P' };

const KANJI: Record<PieceType, string> = { K: '王', R: '飛', B: '角', G: '金', S: '銀', N: '桂', L: '香', P: '歩' };
const KANJI_PROMOTED: Partial<Record<PieceType, string>> = { R: '龍', B: '馬', S: '全', N: '圭', L: '杏', P: 'と' };

const NAME_HE: Record<PieceType, string> = {
  K: 'מלך', R: 'צריח', B: 'רץ', G: 'גנרל זהב', S: 'גנרל כסף', N: 'פרש', L: 'רומח', P: 'רגלי',
};
const NAME_HE_PLURAL: Record<PieceType, string> = {
  K: 'מלכים', R: 'צריחים', B: 'רצים', G: 'גנרלי זהב', S: 'גנרלי כסף', N: 'פרשים', L: 'רמחים', P: 'רגלים',
};
const NAME_HE_PROMOTED: Partial<Record<PieceType, string>> = {
  R: 'דרקון', B: 'סוס', S: 'כסף מוכתר', N: 'פרש מוכתר', L: 'רומח מוכתר', P: 'טוקין',
};

export const SIDE_HE: Record<Side, string> = { sente: 'הפותח', gote: 'המשיב' };

export function letterOf(p: Piece): string {
  return (p.promoted ? '+' : '') + LETTER[p.type];
}

export function kanjiOf(p: Piece): string {
  if (p.promoted) return KANJI_PROMOTED[p.type] ?? KANJI[p.type];
  if (p.type === 'K') return p.side === 'sente' ? '王' : '玉';
  return KANJI[p.type];
}

export function nameOf(p: Piece): string {
  return p.promoted ? (NAME_HE_PROMOTED[p.type] ?? NAME_HE[p.type]) : NAME_HE[p.type];
}

export function parseSfen(sfen: string): Position {
  const [board = '9/9/9/9/9/9/9/9/9', turn = 'b', hands = '-'] = sfen.trim().split(/\s+/);
  const rows = board.split('/');
  if (rows.length !== 9) throw new Error(`SFEN needs 9 ranks: ${sfen}`);
  const squares: Square[] = [];
  rows.forEach((row, r) => {
    let file = 9;
    let promoted = false;
    for (const ch of row) {
      if (ch === '+') { promoted = true; continue; }
      if (/[1-9]/.test(ch)) {
        for (let i = 0; i < Number(ch); i++) {
          squares.push({ file, rank: r + 1, id: `${file}${r + 1}`, piece: null });
          file--;
        }
        continue;
      }
      const type = ch.toUpperCase() as PieceType;
      if (!(type in LETTER)) throw new Error(`Bad SFEN piece "${ch}" in ${sfen}`);
      const side: Side = ch === ch.toUpperCase() ? 'sente' : 'gote';
      squares.push({ file, rank: r + 1, id: `${file}${r + 1}`, piece: { type, side, promoted } });
      promoted = false;
      file--;
    }
    if (file !== 0) throw new Error(`SFEN rank ${r + 1} does not have 9 files: ${sfen}`);
  });

  const handsOut: Position['hands'] = { sente: {}, gote: {} };
  if (hands !== '-') {
    const re = /(\d*)([RBGSNLPrbgsnlp])/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(hands))) {
      const n = m[1] ? Number(m[1]) : 1;
      const side: Side = m[2] === m[2].toUpperCase() ? 'sente' : 'gote';
      const t = m[2].toUpperCase() as PieceType;
      handsOut[side][t] = (handsOut[side][t] ?? 0) + n;
    }
  }
  return { squares, hands: handsOut, turn: turn === 'w' ? 'gote' : 'sente' };
}

/** Plain-Hebrew description of a position, for the "תיאור הלוח" text alternative. */
export function describe(pos: Position): string[] {
  const lines: string[] = [];
  for (const side of ['sente', 'gote'] as Side[]) {
    const own = pos.squares.filter((s) => s.piece?.side === side);
    if (own.length === 0) continue;
    // group by piece name, keep board order (rank, then file 9→1)
    const groups = new Map<string, string[]>();
    for (const s of own) {
      const n = nameOf(s.piece!);
      groups.set(n, [...(groups.get(n) ?? []), s.id]);
    }
    const parts = [...groups.entries()].map(([n, sq]) => `${n} ב־${sq.join(', ')}`);
    lines.push(`${SIDE_HE[side]}: ${parts.join('; ')}.`);
  }
  for (const side of ['sente', 'gote'] as Side[]) {
    const h = pos.hands[side];
    const entries = Object.entries(h) as [PieceType, number][];
    if (entries.length) {
      lines.push(
        `ביד של ${SIDE_HE[side]}: ` +
          entries.map(([t, n]) => (n === 1 ? NAME_HE[t] : `${n} ${NAME_HE_PLURAL[t]}`)).join(', ') + '.',
      );
    }
  }
  if (lines.length === 0) lines.push('הלוח ריק.');
  return lines;
}

/** Short label for one square, used as its accessible name when a task makes the board tappable. */
export function squareLabel(s: Square): string {
  if (!s.piece) return `משבצת ${s.id}, ריקה`;
  return `משבצת ${s.id}, ${nameOf(s.piece)} של ${SIDE_HE[s.piece.side]}`;
}
