// AGPL-3.0-or-later, like the rest of this site.
import * as lines from '../learn/stages/openings-he';

const PLIES = 8;

const book = new Map<string, string[]>();
for (const stage of Object.values(lines)) {
  if (!('line' in stage)) continue;
  const moves = stage.line.split(' ').slice(0, PLIES);
  moves.forEach((usi, i) => {
    const key = moves.slice(0, i).join(' ');
    const replies = book.get(key) ?? [];
    replies.push(usi);
    book.set(key, replies);
  });
}

export function bookMove(moves: string[], random: () => number = Math.random): string | undefined {
  const replies = book.get(moves.join(' '));
  return replies?.[Math.floor(random() * replies.length)];
}
