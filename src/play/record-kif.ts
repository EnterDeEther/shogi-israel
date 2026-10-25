// Shogi Israel: a finished game against the computer as KIF, for the end-of-game buttons and the account's game log.
// AGPL-3.0-or-later, like the rest of this site.
import { type KifEnd, makeKif } from '../lib/kif';
import type { GameEnd } from './game';
import type { GameRecord } from './record';

const KIF_REASON: Record<GameEnd['reason'], KifEnd['reason']> = {
  mate: 'checkmate',
  stalemate: 'checkmate', // no legal move: a loss, written like a mate
  resign: 'resign',
  time: 'timeout',
  repetition: 'repetition',
  perpetual: 'repetition', // with a winner: the side that gave perpetual check lost
  impasse: 'impasse',
  draw: 'repetition',
};

export function recordKif(r: GameRecord): string {
  const ai = `מחשב רמה ${r.level} (${r.engine})`;
  return makeKif({
    startSfen: r.startSfen,
    moves: r.moves,
    sente: r.playerColor === 'sente' ? 'שחקן' : ai,
    gote: r.playerColor === 'gote' ? 'שחקן' : ai,
    date: new Date(r.startedAt),
    event: 'משחק נגד המחשב',
    end: r.result && { reason: KIF_REASON[r.result.reason], winner: r.result.winner },
  });
}
