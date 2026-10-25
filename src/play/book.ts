// Shogi Israel: a small opening book, so the computer does not open the same way every game.
// Lishogi plays from an opening book up to level 8 (lila modules/shoginet/src/main/Player.scala); theirs is not
// free to copy, so ours is built from the opening lines of our own lessons (src/learn/stages/openings-he.ts,
// every line replayed by the tests). Only the first plies are used: later in
// those lines the opponent sometimes plays a lesson's deliberate mistake.
// AGPL-3.0-or-later, like the rest of this site.
import * as lines from '../learn/stages/openings-he';

const PLIES = 8;

const book = new Map<string, string[]>(); // moves so far, joined by spaces -> book replies
for (const stage of Object.values(lines)) {
  if (!('line' in stage)) continue;
  const moves = stage.line.split(' ').slice(0, PLIES);
  moves.forEach((usi, i) => {
    const key = moves.slice(0, i).join(' ');
    const replies = book.get(key) ?? [];
    replies.push(usi); // duplicates are kept: a reply many lessons share is picked more often
    book.set(key, replies);
  });
}

/** A book reply after `moves` from the start position, or undefined when out of book. */
export function bookMove(moves: string[], random: () => number = Math.random): string | undefined {
  const replies = book.get(moves.join(' '));
  return replies?.[Math.floor(random() * replies.length)];
}
