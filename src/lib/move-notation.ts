import { currentPieceSet, type PieceSet } from './piece-set';

const HEBREW: Record<string, string> = {
  K: 'מ', R: 'צ', B: 'רץ', G: 'ז', S: 'כ', N: 'פ', L: 'ר', P: 'ח',
  '+R': 'ד', '+B': 'ס', '+S': 'כ+', '+N': 'פ+', '+L': 'ר+', '+P': 'ח+',
};
const KANJI: Record<string, string> = {
  K: '玉', R: '飛', B: '角', G: '金', S: '銀', N: '桂', L: '香', P: '歩',
  '+R': '龍', '+B': '馬', '+S': '全', '+N': '圭', '+L': '杏', '+P': 'と',
};
const OWN_KANJI: Record<string, string> = { ...KANJI, K: '王' };
const CHESS_BASE: Record<string, string> = {
  K: '♚︎', R: '♜︎', B: '♝︎', G: '', S: '', N: '♞︎', L: '', P: '♟︎',
};
const CHESS: Record<string, string> = Object.fromEntries(
  Object.entries(CHESS_BASE).flatMap(([k, v]) => [[k, v], [`+${k}`, `+${v}`]]),
);

const MOVE = /(\+?[KRBGSNLP])(\d\d(?=[-x*]))?([-x*])(\d\d)([+=]?)/g;

function mapFor(set: PieceSet, lessons: boolean, opponent: boolean): Record<string, string> | null {
  if (set === 'hebrew') return HEBREW;
  if (set === 'kanji') return lessons && !opponent ? OWN_KANJI : KANJI;
  if (set === 'chess' && lessons) return CHESS;
  return null;
}

function convert(set: PieceSet, lessons: boolean, opponent = false) {
  const map = mapFor(set, lessons, opponent);
  return (whole: string, p: string, from: string | undefined, sep: string, to: string, end: string): string => {
    if (!map) return lessons ? p + (from ?? '') + (sep === 'x' ? '×' : sep) + to + end : whole;
    return (map[p] ?? p) + (from ? `-${from}` : '') + (sep === 'x' ? '×' : sep) + to + end;
  };
}

export function localMove(move: string, set: PieceSet = currentPieceSet()): string {
  return move.replace(MOVE, convert(set, false));
}

export function lessonMove(text: string, set: PieceSet = currentPieceSet(), opponent = false): string {
  return text.replace(MOVE, convert(set, true, opponent));
}

export const isMoveText = (text: string): boolean => new RegExp(MOVE.source).test(text);
