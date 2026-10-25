// Shogi Israel: a small mate solver for tsume (בעיות מט), on top of shogiops.
// Tsume rules: the attacker gives check with every move, the defender holds every piece that is not on
// the board or in the attacker's hand, and plays the longest defence. Used by the player (the defender's
// answer to a wrong move) and by test/tsume.test.ts. scripts/tsume/gen.py runs the same search on cshogi.
// No DOM here. AGPL-3.0-or-later, like the rest of this site.
import { makeSfen, parseSfen } from 'shogiops/sfen';
import type { MoveOrDrop, Role } from 'shogiops/types';
import { makeUsi } from 'shogiops/util';
import type { Position } from 'shogiops/variant/position';
import { pieceCanPromote, pieceForcePromote, promote } from 'shogiops/variant/util';
import { attacks, between } from 'shogiops/attacks';
import { SquareSet } from 'shogiops/square-set';

export const parseTsume = (sfen: string): Position => parseSfen('standard', sfen, false).unwrap();

const key = (pos: Position): string => makeSfen(pos).split(' ', 3).join(' ');

/** Every legal move of the side to move, with both the promoting and the non-promoting version. */
export function legalMoves(pos: Position): MoveOrDrop[] {
  const out: MoveOrDrop[] = [];
  const ctx = pos.ctx();
  for (const [from, dests] of pos.allMoveDests(ctx)) {
    const piece = pos.board.get(from)!;
    for (const to of dests) {
      const force = pieceForcePromote('standard')(piece, to);
      if (!force) out.push({ from, to });
      if (force || pieceCanPromote('standard')(piece, from, to, pos.board.get(to))) out.push({ from, to, promotion: true });
    }
  }
  for (const [role] of pos.hands[pos.turn]) {
    for (const to of pos.dropDests({ color: pos.turn, role: role as Role }, ctx)) out.push({ role: role as Role, to });
  }
  return out;
}

const after = (pos: Position, md: MoveOrDrop): Position => {
  const c = pos.clone();
  c.play(md);
  return c;
};

/** The attacker's checking moves, each with the position after it. */
export function checks(pos: Position): { md: MoveOrDrop; next: Position }[] {
  const out: { md: MoveOrDrop; next: Position }[] = [];
  const me = pos.turn;
  const them = opposite(me);
  const king = pos.kingsOf(them).singleSquare();
  if (king === undefined) return out;
  const occ = pos.board.occupied;
  // pieces that may uncover a check from a rook, bishop or lance behind them
  let uncover = SquareSet.empty();
  for (const s of (pos as any).squareSnipers(king, me) as SquareSet) {
    const b = between(king, s).intersect(occ);
    if (b.size() === 1) uncover = uncover.union(b);
  }
  const push = (md: MoveOrDrop) => out.push({ md, next: after(pos, md) });
  const ctx = pos.ctx();
  for (const [from, dests] of pos.allMoveDests(ctx)) {
    const piece = pos.board.get(from)!;
    const occ2 = occ.without(from);
    for (const to of dests) {
      const force = pieceForcePromote('standard')(piece, to);
      const can = force || pieceCanPromote('standard')(piece, from, to, pos.board.get(to));
      for (const promotion of force ? [true] : can ? [false, true] : [false]) {
        const role = promotion ? (promote('standard')(piece.role) ?? piece.role) : piece.role;
        const md = promotion ? { from, to, promotion } : { from, to };
        if (attacks({ color: them, role }, king, occ2).has(to)) push(md);
        else if (uncover.has(from)) {
          const next = after(pos, md);
          if (next.isCheck()) out.push({ md, next });
        }
      }
    }
  }
  for (const [role] of pos.hands[me]) {
    const r = role as Role;
    const dests = pos.dropDests({ color: me, role: r }, ctx).intersect(attacks({ color: them, role: r }, king, occ));
    for (const to of dests) push({ role: r, to });
  }
  return out;
}

export const isMate = (pos: Position): boolean => pos.isCheck() && pos.outcome()?.result === 'checkmate';

export class Solver {
  // position -> plies known to be enough for mate (proved) / known not to be enough (disproved)
  private proved = new Map<string, number>();
  private disproved = new Map<string, number>();
  nodes = 0;

  constructor(readonly nodeLimit = 3_000_000) {}

  /** Can the attacker (to move) mate within `plies` plies (odd)? */
  mates(pos: Position, plies: number): boolean {
    if (plies < 1) return false;
    const k = key(pos);
    const p = this.proved.get(k);
    if (p !== undefined && p <= plies) return true;
    const d = this.disproved.get(k);
    if (d !== undefined && d >= plies) return false;
    if (++this.nodes > this.nodeLimit) throw new Error('node limit');
    const cs = checks(pos);
    // try the moves that leave the defender fewest replies first
    const ranked = cs.map((c) => ({ ...c, replies: legalMoves(c.next) })).sort((a, b) => a.replies.length - b.replies.length);
    let ok = false;
    for (const c of ranked) {
      if (c.replies.length === 0) { ok = true; break; } // mate now (pawn-drop mate is already illegal)
      if (plies >= 3 && c.replies.every((r) => this.mates(after(c.next, r), plies - 2))) { ok = true; break; }
    }
    if (ok) this.proved.set(k, Math.min(p ?? plies, plies));
    else this.disproved.set(k, Math.max(d ?? 0, plies));
    return ok;
  }

  /** Shortest mate in plies, up to `max`; undefined = none. */
  distance(pos: Position, max: number): number | undefined {
    for (let n = 1; n <= max; n += 2) if (this.mates(pos, n)) return n;
    return undefined;
  }

  /** Defender to move: how many more plies the attacker needs, against the best defence (0 = already mate). */
  defend(pos: Position, max: number): number | undefined {
    const replies = legalMoves(pos);
    if (replies.length === 0) return pos.isCheck() ? 0 : undefined;
    let worst = 0;
    for (const r of replies) {
      const d = this.distance(after(pos, r), max - 1);
      if (d === undefined) return undefined;
      worst = Math.max(worst, d + 1);
    }
    return worst;
  }
}

export interface Analysis {
  plies: number; // the mate length: 1, 3, 5...
  line: string[]; // main line in USI: attacker, defender, ..., attacker (mate)
  unique: boolean; // every attacker move of the line is the only one that mates in time (the last one may have twins)
  leftover: number; // pieces left in the attacker's hand at the end of the line
  duals: number; // other mating moves at the last move
}

/** Which defender reply the line follows: the longest defence; on a tie, not a drop, then the one that uses up the attacker's hand. */
function bestReply(s: Solver, pos: Position, need: number): MoveOrDrop {
  let best: { md: MoveOrDrop; score: number } | undefined;
  for (const r of legalMoves(pos)) {
    const next = after(pos, r);
    const d = s.distance(next, need)!;
    // longest first; a non-drop over a drop (a drop that only delays is a "useless interposition")
    const score = d * 100 + ('role' in r ? 0 : 10) + (pos.board.has(r.to) ? 1 : 0);
    if (!best || score > best.score) best = { md: r, score };
  }
  return best!.md;
}

/** Analyse a puzzle position (attacker to move): mate length, main line and its quality. */
export function analyse(sfen: string, maxPlies = 9, nodeLimit?: number): Analysis | undefined {
  const s = new Solver(nodeLimit);
  let pos = parseTsume(sfen);
  const plies = s.distance(pos, maxPlies);
  if (plies === undefined) return undefined;
  const line: string[] = [];
  let unique = true;
  let duals = 0;
  for (let left = plies; left >= 1; left -= 2) {
    const good = checks(pos).filter((c) => left === 1 ? isMate(c.next) : s.defend(c.next, left - 1) === left - 1);
    if (left > 1 && good.length !== 1) unique = false;
    if (left === 1) duals = good.length - 1;
    // the move whose best defence is still the longest (all `good` moves mate exactly in time)
    const chosen = good[0];
    line.push(makeUsi(chosen.md));
    pos = chosen.next;
    if (left === 1) break;
    const reply = bestReply(s, pos, left - 2);
    line.push(makeUsi(reply));
    pos = after(pos, reply);
  }
  return { plies, line, unique, leftover: pos.hands[opposite(pos.turn)].count(), duals };
}

const opposite = (c: Color): Color => (c === 'sente' ? 'gote' : 'sente');
