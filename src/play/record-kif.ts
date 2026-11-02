// AGPL-3.0-or-later, like the rest of this site.
import { type KifEnd, makeKif } from '../lib/kif';
import type { GameEnd } from './game';
import { type GameRecord, isLocal } from './record';

const KIF_REASON: Record<GameEnd['reason'], KifEnd['reason']> = {
  mate: 'checkmate',
  stalemate: 'checkmate',
  resign: 'resign',
  time: 'timeout',
  repetition: 'repetition',
  perpetual: 'repetition',
  impasse: 'impasse',
  draw: 'repetition',
  agreement: 'repetition',
};

export function recordKif(r: GameRecord): string {
  const ai = `מחשב רמה ${r.level} (${r.engine})`;
  const local = isLocal(r);
  return makeKif({
    startSfen: r.startSfen,
    moves: r.moves,
    sente: local ? 'פותח' : r.playerColor === 'sente' ? 'שחקן' : ai,
    gote: local ? 'משיב' : r.playerColor === 'gote' ? 'שחקן' : ai,
    date: new Date(r.startedAt),
    event: local ? 'שני שחקנים על מכשיר אחד' : 'משחק נגד המחשב',
    end: r.result && { reason: KIF_REASON[r.result.reason], winner: r.result.winner },
  });
}
