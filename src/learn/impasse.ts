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
  piecesInZone: number;
  points: number;
  needed: number;
  canDeclare: boolean;
}

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
