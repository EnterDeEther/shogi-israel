import { currentPieceSet, type PieceSet } from './piece-set';

const HEBREW: Record<string, string> = {
  K: 'מ', R: 'צ', B: 'רץ', G: 'ז', S: 'כ', N: 'פ', L: 'ר', P: 'ח',
  '+R': 'ד', '+B': 'ס', '+S': 'כ+', '+N': 'פ+', '+L': 'ר+', '+P': 'ח+',
};
const KANJI: Record<string, string> = {
  K: '玉', R: '飛', B: '角', G: '金', S: '銀', N: '桂', L: '香', P: '歩',
  '+R': '龍', '+B': '馬', '+S': '全', '+N': '圭', '+L': '杏', '+P': 'と',
};

export function localMove(move: string, set: PieceSet = currentPieceSet()): string {
  const map = set === 'hebrew' ? HEBREW : set === 'kanji' ? KANJI : null;
  if (!map) return move;
  return move.replace(/^(\+?[KRBGSNLP])/, (p) => map[p] ?? p);
}
