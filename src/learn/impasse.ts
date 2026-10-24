// Shogi Israel: the 27-point impasse declaration (入玉宣言, "הכרזת ניצחון בנקודות").
// shogiops (0.21 and 0.22) has no impasse logic: Position.outcome() only reports checkmate,
// stalemate and bare-kings draws. Lishogi runs this rule on its server (scalashogi), not in
// shogiops. So we check it ourselves, on top of shogiops positions.
//
// Rule as Lishogi / FESA / CSA run it (glossary row game.impasse_declaration; lishogi.org/page/impasse).
// The declaring player, on their own turn:
//   1. has the king inside the opponent's promotion zone (the 3 far ranks),
//   2. is not in check,
//   3. has at least 10 other pieces inside that zone,
//   4. scores enough points, counting pieces in the zone (not the king) + all pieces in hand:
//      rook, bishop, dragon, horse = 5; every other piece = 1;
//      sente (first player) needs 28, gote (second player) needs 27.
// A declaration that misses any condition loses (on Lishogi the button simply isn't offered).
// Handicap games score differently on some servers; not covered here.
// AGPL-3.0-or-later, like the rest of src/learn/.
import type { Role } from 'shogiops/types';
import type { Position } from 'shogiops/variant/position';
import { promotionZone } from 'shogiops/variant/util';

const BIG: Role[] = ['rook', 'bishop', 'dragon', 'horse'];
export const IMPASSE_POINTS_NEEDED: Record<Color, number> = { sente: 28, gote: 27 };

export const pieceValue = (role: Role): number => (BIG.includes(role) ? 5 : role === 'king' ? 0 : 1);

export interface ImpasseCheck {
  kingInZone: boolean;
  notInCheck: boolean;
  piecesInZone: number; // not counting the king
  points: number;
  needed: number;
  canDeclare: boolean;
}

/** Can `color` (default: the side to move) declare an impasse win right now? Standard shogi only. */
export function impasse(pos: Position, color: Color = pos.turn): ImpasseCheck {
  const zone = promotionZone('standard')(color);
  const own = pos.board.color(color);
  const kingSq = pos.board.pieces(color, 'king').singleSquare();
  const kingInZone = kingSq !== undefined && zone.has(kingSq);
  const notInCheck = !pos.isCheck(color);

  let piecesInZone = 0;
  let points = 0;
  for (const sq of own.intersect(zone)) {
    const role = pos.board.getRole(sq)!;
    if (role === 'king') continue;
    piecesInZone++;
    points += pieceValue(role);
  }
  for (const [role, n] of pos.hands.color(color)) points += pieceValue(role) * n;

  const needed = IMPASSE_POINTS_NEEDED[color];
  return {
    kingInZone,
    notInCheck,
    piecesInZone,
    points,
    needed,
    canDeclare: kingInZone && notInCheck && piecesInZone >= 10 && points >= needed,
  };
}
