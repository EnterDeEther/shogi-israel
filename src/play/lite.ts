const P = 1, L = 2, N = 3, S = 4, G = 5, B = 6, R = 7, K = 8;
const PROMOTE = [0, 9, 10, 11, 12, 0, 13, 14, 0, 0, 0, 0, 0, 0, 0];
const BASE = [0, 1, 2, 3, 4, 5, 6, 7, 8, 1, 2, 3, 4, 6, 7];
const VALUE = [0, 100, 300, 350, 500, 550, 800, 1000, 0, 520, 520, 520, 520, 1100, 1300];
const HAND_VALUE = [0, 115, 320, 370, 540, 600, 900, 1100];
const LETTERS = ' PLNSGBRK';
const DROP = 81;
const MATE = 30000;
const INF = 32000;
const MAX_PLY = 48;
const MAX_MOVES = 700;

type Dir = [number, number];
const GOLD: Dir[] = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, 0]];
const DIAG: Dir[] = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const ORTHO: Dir[] = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const STEPS: Dir[][] = [
  [], [[-1, 0]], [], [[-2, -1], [-2, 1]], [[-1, -1], [-1, 0], [-1, 1], [1, -1], [1, 1]], GOLD, [], [], [...DIAG, ...ORTHO],
  GOLD, GOLD, GOLD, GOLD, ORTHO, DIAG,
];
const SLIDES: Dir[][] = [[], [], [[-1, 0]], [], [], [], DIAG, ORTHO, [], [], [], [], [], DIAG, ORTHO];

const row = (sq: number) => (sq / 9) | 0;
const col = (sq: number) => sq % 9;
const on = (r: number, c: number) => r >= 0 && r < 9 && c >= 0 && c < 9;

const stepTo: number[][][][] = [[], []];
const rays: number[][][][][] = [[], []];
const attackSteps: [number, number][][][] = [[], []];
const attackRays: [number[], number][][][] = [[], []];
const DIST = new Int8Array(81 * 81);

for (let a = 0; a < 81; a++) for (let b = 0; b < 81; b++) DIST[a * 81 + b] = Math.max(Math.abs(row(a) - row(b)), Math.abs(col(a) - col(b)));

for (const side of [0, 1]) {
  const fw = side === 0 ? 1 : -1;
  for (let t = 1; t <= 14; t++) {
    stepTo[side][t] = [];
    rays[side][t] = [];
    for (let sq = 0; sq < 81; sq++) {
      const r = row(sq), c = col(sq);
      stepTo[side][t][sq] = STEPS[t].filter(([dr, dc]) => on(r + dr * fw, c + dc)).map(([dr, dc]) => (r + dr * fw) * 9 + c + dc);
      rays[side][t][sq] = SLIDES[t].map(([dr, dc]) => {
        const out: number[] = [];
        for (let k = 1; on(r + dr * fw * k, c + dc * k); k++) out.push((r + dr * fw * k) * 9 + c + dc * k);
        return out;
      }).filter((ray) => ray.length > 0);
    }
  }
  for (let sq = 0; sq < 81; sq++) {
    const steps = new Map<number, number>();
    const slides = new Map<string, [number[], number]>();
    for (let t = 1; t <= 14; t++) {
      for (let from = 0; from < 81; from++) {
        if (stepTo[side][t][from].includes(sq)) steps.set(from, (steps.get(from) ?? 0) | (1 << t));
      }
      for (const [dr, dc] of SLIDES[t]) {
        const odr = -dr * fw, odc = -dc;
        const key = `${odr},${odc}`;
        let entry = slides.get(key);
        if (!entry) {
          const out: number[] = [];
          for (let k = 1; on(row(sq) + odr * k, col(sq) + odc * k); k++) out.push((row(sq) + odr * k) * 9 + col(sq) + odc * k);
          entry = [out, 0];
          slides.set(key, entry);
        }
        entry[1] |= 1 << t;
      }
    }
    attackSteps[side][sq] = [...steps.entries()];
    attackRays[side][sq] = [...slides.values()].filter(([out]) => out.length > 0);
  }
}

let seed = 0x9e3779b9;
const rand32 = () => {
  seed ^= seed << 13;
  seed ^= seed >>> 17;
  seed ^= seed << 5;
  return seed >>> 0;
};
const Z_BOARD = Uint32Array.from({ length: 81 * 29 * 2 }, rand32);
const Z_HAND = Uint32Array.from({ length: 2 * 8 * 20 * 2 }, rand32);
const Z_TURN = [rand32(), rand32()];

const squareName = (sq: number) => `${9 - col(sq)}${String.fromCharCode(97 + row(sq))}`;
const parseSquare = (s: string) => (s.charCodeAt(1) - 97) * 9 + 9 - Number(s[0]);

export const moveFrom = (m: number) => m & 127;
export const moveTo = (m: number) => (m >> 7) & 127;
const movePromo = (m: number) => (m >> 14) & 1;
const moveDrop = (m: number) => (m >> 15) & 15;
const encode = (from: number, to: number, promo: number, drop = 0) => from | (to << 7) | (promo << 14) | (drop << 15);

export function moveToUsi(m: number): string {
  const from = moveFrom(m), to = moveTo(m);
  if (from === DROP) return `${LETTERS[moveDrop(m)]}*${squareName(to)}`;
  return `${squareName(from)}${squareName(to)}${movePromo(m) ? '+' : ''}`;
}

export function usiToMove(usi: string): number {
  if (usi[1] === '*') return encode(DROP, parseSquare(usi.slice(2, 4)), 0, LETTERS.indexOf(usi[0]));
  return encode(parseSquare(usi.slice(0, 2)), parseSquare(usi.slice(2, 4)), usi[4] === '+' ? 1 : 0);
}

export class Pos {
  board = new Int8Array(81);
  hand = new Int8Array(16);
  turn = 0;
  king = [-1, -1];
  h1 = 0;
  h2 = 0;
  private undo: number[] = [];

  static fromSfen(sfen: string): Pos {
    const pos = new Pos();
    const [placement, turn, hand] = sfen.trim().split(/\s+/);
    let r = 0, c = 0, promoted = false;
    for (const ch of placement) {
      if (ch === '/') { r++; c = 0; continue; }
      if (ch === '+') { promoted = true; continue; }
      if (ch >= '1' && ch <= '9') { c += Number(ch); continue; }
      const base = LETTERS.indexOf(ch.toUpperCase());
      if (base < 1) throw new Error(`bad sfen ${sfen}`);
      const t = promoted ? PROMOTE[base] : base;
      const side = ch === ch.toUpperCase() ? 0 : 1;
      pos.board[r * 9 + c] = side === 0 ? t : -t;
      if (t === K) pos.king[side] = r * 9 + c;
      promoted = false;
      c++;
    }
    pos.turn = turn === 'w' ? 1 : 0;
    if (hand && hand !== '-') {
      let n = 0;
      for (const ch of hand) {
        if (ch >= '0' && ch <= '9') { n = n * 10 + Number(ch); continue; }
        const t = LETTERS.indexOf(ch.toUpperCase());
        pos.hand[(ch === ch.toUpperCase() ? 0 : 8) + t] += n || 1;
        n = 0;
      }
    }
    pos.rehash();
    return pos;
  }

  rehash(): void {
    let h1 = 0, h2 = 0;
    for (let sq = 0; sq < 81; sq++) {
      const p = this.board[sq];
      if (!p) continue;
      const i = (sq * 29 + p + 14) * 2;
      h1 ^= Z_BOARD[i];
      h2 ^= Z_BOARD[i + 1];
    }
    for (let s = 0; s < 2; s++) for (let t = 1; t <= 7; t++) {
      const i = ((s * 8 + t) * 20 + this.hand[s * 8 + t]) * 2;
      h1 ^= Z_HAND[i];
      h2 ^= Z_HAND[i + 1];
    }
    if (this.turn) { h1 ^= Z_TURN[0]; h2 ^= Z_TURN[1]; }
    this.h1 = h1 >>> 0;
    this.h2 = h2 >>> 0;
  }

  get key(): number {
    return this.h1 * 1048576 + (this.h2 & 1048575);
  }

  private xorPiece(sq: number, p: number): void {
    const i = (sq * 29 + p + 14) * 2;
    this.h1 = (this.h1 ^ Z_BOARD[i]) >>> 0;
    this.h2 = (this.h2 ^ Z_BOARD[i + 1]) >>> 0;
  }

  private setHand(side: number, t: number, n: number): void {
    const at = side * 8 + t;
    const a = ((side * 8 + t) * 20 + this.hand[at]) * 2;
    const b = ((side * 8 + t) * 20 + n) * 2;
    this.h1 = (this.h1 ^ Z_HAND[a] ^ Z_HAND[b]) >>> 0;
    this.h2 = (this.h2 ^ Z_HAND[a + 1] ^ Z_HAND[b + 1]) >>> 0;
    this.hand[at] = n;
  }

  attacked(sq: number, by: number): boolean {
    const board = this.board;
    for (const [from, mask] of attackSteps[by][sq]) {
      const p = board[from];
      if (p && (p > 0 ? 0 : 1) === by && (mask >> (p > 0 ? p : -p)) & 1) return true;
    }
    for (const [out, mask] of attackRays[by][sq]) {
      for (let i = 0; i < out.length; i++) {
        const p = board[out[i]];
        if (!p) continue;
        if ((p > 0 ? 0 : 1) === by && (mask >> (p > 0 ? p : -p)) & 1) return true;
        break;
      }
    }
    return false;
  }

  inCheck(side = this.turn): boolean {
    const k = this.king[side];
    return k >= 0 && this.attacked(k, side ^ 1);
  }

  make(m: number): void {
    const us = this.turn, sign = us === 0 ? 1 : -1;
    const from = moveFrom(m), to = moveTo(m);
    let captured = 0;
    if (from === DROP) {
      const t = moveDrop(m);
      this.setHand(us, t, this.hand[us * 8 + t] - 1);
      this.board[to] = sign * t;
      this.xorPiece(to, sign * t);
    } else {
      const p = this.board[from];
      captured = this.board[to];
      if (captured) {
        this.xorPiece(to, captured);
        const ct = BASE[captured > 0 ? captured : -captured];
        this.setHand(us, ct, this.hand[us * 8 + ct] + 1);
      }
      const moved = movePromo(m) ? sign * PROMOTE[sign * p] : p;
      this.xorPiece(from, p);
      this.board[from] = 0;
      this.board[to] = moved;
      this.xorPiece(to, moved);
      if (sign * p === K) this.king[us] = to;
    }
    this.undo.push(captured);
    this.turn = us ^ 1;
    this.h1 = (this.h1 ^ Z_TURN[0]) >>> 0;
    this.h2 = (this.h2 ^ Z_TURN[1]) >>> 0;
  }

  unmake(m: number): void {
    const captured = this.undo.pop()!;
    this.turn ^= 1;
    this.h1 = (this.h1 ^ Z_TURN[0]) >>> 0;
    this.h2 = (this.h2 ^ Z_TURN[1]) >>> 0;
    const us = this.turn, sign = us === 0 ? 1 : -1;
    const from = moveFrom(m), to = moveTo(m);
    if (from === DROP) {
      const t = moveDrop(m);
      this.xorPiece(to, sign * t);
      this.board[to] = 0;
      this.setHand(us, t, this.hand[us * 8 + t] + 1);
      return;
    }
    const moved = this.board[to];
    const p = movePromo(m) ? sign * BASE[sign * moved] : moved;
    this.xorPiece(to, moved);
    this.board[to] = captured;
    this.board[from] = p;
    this.xorPiece(from, p);
    if (captured) {
      this.xorPiece(to, captured);
      const ct = BASE[captured > 0 ? captured : -captured];
      this.setHand(us, ct, this.hand[us * 8 + ct] - 1);
    }
    if (sign * p === K) this.king[us] = from;
  }

  generate(out: Int32Array, captures: boolean, all = false, dropMate = true): number {
    const us = this.turn, board = this.board, sign = us === 0 ? 1 : -1;
    let n = 0;
    const add = (from: number, to: number, t: number) => {
      const r1 = row(from), r2 = row(to);
      const promotable = PROMOTE[t] !== 0;
      const zone = promotable && (us === 0 ? r1 <= 2 || r2 <= 2 : r1 >= 6 || r2 >= 6);
      const last = us === 0 ? r2 : 8 - r2;
      const must = ((t === P || t === L) && last === 0) || (t === N && last <= 1);
      if (zone) out[n++] = encode(from, to, 1);
      if (!must && (!zone || all || (t !== P && t !== B && t !== R))) out[n++] = encode(from, to, 0);
    };
    for (let from = 0; from < 81; from++) {
      const p = board[from];
      if (!p || (p > 0 ? 0 : 1) !== us) continue;
      const t = sign * p;
      const steps = stepTo[us][t][from];
      for (let i = 0; i < steps.length; i++) {
        const to = steps[i], q = board[to];
        if (q ? (q > 0 ? 0 : 1) === us : captures) continue;
        add(from, to, t);
      }
      const rs = rays[us][t][from];
      for (let j = 0; j < rs.length; j++) {
        const ray = rs[j];
        for (let i = 0; i < ray.length; i++) {
          const to = ray[i], q = board[to];
          if (q) {
            if ((q > 0 ? 0 : 1) !== us) add(from, to, t);
            break;
          }
          if (!captures) add(from, to, t);
        }
      }
    }
    if (captures) return n;
    const hand = this.hand, base = us * 8;
    let any = false;
    for (let t = 1; t <= 7; t++) if (hand[base + t]) any = true;
    if (!any) return n;
    let pawnFiles = 0;
    if (hand[base + P]) for (let sq = 0; sq < 81; sq++) if (board[sq] === sign * P) pawnFiles |= 1 << col(sq);
    const enemyKing = this.king[us ^ 1];
    for (let to = 0; to < 81; to++) {
      if (board[to]) continue;
      const last = us === 0 ? row(to) : 8 - row(to);
      for (let t = 1; t <= 7; t++) {
        if (!hand[base + t]) continue;
        if ((t === P || t === L) && last === 0) continue;
        if (t === N && last <= 1) continue;
        if (t === P) {
          if (pawnFiles & (1 << col(to))) continue;
          if (dropMate && enemyKing === to - 9 * sign && this.pawnDropMates(to)) continue;
        }
        out[n++] = encode(DROP, to, 0, t);
      }
    }
    return n;
  }

  private pawnDropMates(to: number): boolean {
    const m = encode(DROP, to, 0, P);
    this.make(m);
    const mates = !this.inCheck(this.turn ^ 1) && !this.hasLegalMove();
    this.unmake(m);
    return mates;
  }

  hasLegalMove(): boolean {
    const buf = new Int32Array(MAX_MOVES);
    const n = this.generate(buf, false, true, false);
    for (let i = 0; i < n; i++) if (this.legal(buf[i])) return true;
    return false;
  }

  legal(m: number): boolean {
    const us = this.turn;
    this.make(m);
    const ok = !this.inCheck(us);
    this.unmake(m);
    return ok;
  }

  legalMoves(all = true): number[] {
    const buf = new Int32Array(MAX_MOVES);
    const n = this.generate(buf, false, all);
    const out: number[] = [];
    for (let i = 0; i < n; i++) if (this.legal(buf[i])) out.push(buf[i]);
    return out;
  }

  evaluate(): number {
    const board = this.board, ks = this.king;
    let score = 0;
    for (let sq = 0; sq < 81; sq++) {
      const p = board[sq];
      if (!p) continue;
      const side = p > 0 ? 0 : 1, t = p > 0 ? p : -p;
      let v = VALUE[t];
      const r = row(sq);
      if (t === K) {
        const depth = side === 0 ? 8 - r : r;
        if (depth > 2) v -= (depth - 2) * 50;
      } else {
        const own = ks[side], opp = ks[side ^ 1];
        if (own >= 0 && (t === G || t === S || (t >= 9 && t <= 12))) {
          const d = DIST[sq * 81 + own];
          if (d === 1) v += 30;
          else if (d === 2) v += 15;
        }
        if (opp >= 0) {
          const d = DIST[sq * 81 + opp];
          if (d === 1) v += 25;
          else if (d === 2) v += 12;
        }
        if (t !== P && (side === 0 ? r <= 2 : r >= 6)) v += 10;
        if (t === B || t === R || t >= 13) {
          const rs = rays[side][t][sq];
          let reach = 0;
          for (let j = 0; j < rs.length; j++) {
            const ray = rs[j];
            for (let i = 0; i < ray.length; i++) {
              const q = board[ray[i]];
              if (q && (q > 0 ? 0 : 1) === side) break;
              reach++;
              if (q) break;
            }
          }
          v += reach * 4;
        }
      }
      score += side === 0 ? v : -v;
    }
    const hand = this.hand;
    for (let t = 1; t <= 7; t++) score += (hand[t] - hand[8 + t]) * HAND_VALUE[t];
    return this.turn === 0 ? score : -score;
  }
}

export interface LiteStyle {
  depth: number;
  quiesce: boolean;
  noise: number;
  ms: number;
}

export const LITE_STYLES: Record<number, LiteStyle> = {
  1: { depth: 1, quiesce: false, noise: 300, ms: 400 },
  2: { depth: 1, quiesce: true, noise: 180, ms: 700 },
  3: { depth: 2, quiesce: true, noise: 80, ms: 1200 },
  4: { depth: 4, quiesce: true, noise: 30, ms: 2500 },
};

class Stop extends Error {}

class Search {
  nodes = 0;
  private bufs = Array.from({ length: MAX_PLY + 8 }, () => new Int32Array(MAX_MOVES));
  private scores = Array.from({ length: MAX_PLY + 8 }, () => new Int32Array(MAX_MOVES));
  private killers = new Int32Array((MAX_PLY + 8) * 2);
  private history = new Int32Array(2 * 81 * 32);
  private path: number[] = [];

  constructor(
    private pos: Pos,
    private seen: Set<number>,
    private style: LiteStyle,
    private deadline: number,
    private now: () => number,
  ) {}

  private tick(): void {
    if ((++this.nodes & 1023) === 0 && this.now() > this.deadline) throw new Stop();
  }

  private order(ply: number, n: number): void {
    const pos = this.pos, buf = this.bufs[ply], sc = this.scores[ply];
    const k1 = this.killers[ply * 2], k2 = this.killers[ply * 2 + 1];
    for (let i = 0; i < n; i++) {
      const m = buf[i], from = moveFrom(m), to = moveTo(m);
      const q = pos.board[to];
      let s = 0;
      if (q) {
        const mover = from === DROP ? 0 : Math.abs(pos.board[from]);
        s = 100000 + VALUE[q > 0 ? q : -q] * 16 - VALUE[mover] / 16;
      } else if (movePromo(m)) s = 50000;
      else if (m === k1) s = 40000;
      else if (m === k2) s = 39000;
      else s = this.history[this.slot(pos.turn, m)];
      sc[i] = s;
    }
  }

  private slot(us: number, m: number): number {
    const from = moveFrom(m);
    return (us * 81 + moveTo(m)) * 32 + (from === DROP ? 16 + moveDrop(m) : Math.abs(this.pos.board[from]));
  }

  private pick(ply: number, i: number, n: number): number {
    const buf = this.bufs[ply], sc = this.scores[ply];
    let best = i;
    for (let j = i + 1; j < n; j++) if (sc[j] > sc[best]) best = j;
    const m = buf[best], s = sc[best];
    buf[best] = buf[i]; sc[best] = sc[i];
    buf[i] = m; sc[i] = s;
    return m;
  }

  private repeated(): boolean {
    const key = this.pos.key;
    if (this.seen.has(key)) return true;
    for (let i = this.path.length - 2; i >= 0; i -= 2) if (this.path[i] === key) return true;
    return false;
  }

  quiesce(alpha: number, beta: number, ply: number, qd: number): number {
    this.tick();
    const pos = this.pos;
    if (ply >= MAX_PLY) return pos.evaluate();
    const stand = pos.evaluate();
    if (stand >= beta) return stand;
    if (stand > alpha) alpha = stand;
    if (qd >= 6) return stand;
    const n = pos.generate(this.bufs[ply], true);
    this.order(ply, n);
    const us = pos.turn;
    let best = stand;
    for (let i = 0; i < n; i++) {
      const m = this.pick(ply, i, n);
      pos.make(m);
      if (pos.inCheck(us)) { pos.unmake(m); continue; }
      const s = -this.quiesce(-beta, -alpha, ply + 1, qd + 1);
      pos.unmake(m);
      if (s > best) best = s;
      if (s > alpha) alpha = s;
      if (alpha >= beta) break;
    }
    return best;
  }

  negamax(depth: number, alpha: number, beta: number, ply: number): number {
    const pos = this.pos;
    if (ply > 0 && this.repeated()) return 0;
    if (depth <= 0 || ply >= MAX_PLY) {
      if (this.style.quiesce) return this.quiesce(alpha, beta, ply, 0);
      this.tick();
      return pos.evaluate();
    }
    this.tick();
    const n = pos.generate(this.bufs[ply], false);
    this.order(ply, n);
    const us = pos.turn;
    let best = -INF, legal = 0;
    this.path.push(pos.key);
    for (let i = 0; i < n; i++) {
      const m = this.pick(ply, i, n);
      pos.make(m);
      if (pos.inCheck(us)) { pos.unmake(m); continue; }
      legal++;
      const s = -this.negamax(depth - 1, -beta, -alpha, ply + 1);
      pos.unmake(m);
      if (s > best) best = s;
      if (s > alpha) alpha = s;
      if (alpha >= beta) {
        if (!pos.board[moveTo(m)] && !movePromo(m)) {
          if (this.killers[ply * 2] !== m) {
            this.killers[ply * 2 + 1] = this.killers[ply * 2];
            this.killers[ply * 2] = m;
          }
          const h = this.slot(us, m);
          this.history[h] = Math.min(30000, this.history[h] + depth * depth);
        }
        break;
      }
    }
    this.path.pop();
    if (!legal) return -MATE + ply;
    return best;
  }

  root(moves: number[], random: () => number): number {
    const pos = this.pos, style = this.style;
    let scored = moves.map((m) => ({ m, s: 0 }));
    let done: { m: number; s: number }[] | undefined;
    this.path.push(pos.key);
    for (let depth = 1; depth <= style.depth; depth++) {
      let best = -INF;
      const next: { m: number; s: number }[] = [];
      try {
        for (const { m } of scored) {
          const floor = best === -INF ? -INF : best - style.noise - 1;
          pos.make(m);
          const s = -this.negamax(depth - 1, -INF, -floor, 1);
          pos.unmake(m);
          next.push({ m, s });
          if (s > best) best = s;
        }
      } catch (e) {
        if (!(e instanceof Stop)) throw e;
        if (done) break;
        for (const rest of scored.slice(next.length)) next.push({ m: rest.m, s: -INF });
        next.sort((a, b) => b.s - a.s);
        done = next;
        break;
      }
      next.sort((a, b) => b.s - a.s);
      scored = next;
      done = next;
    }
    const list = done ?? scored;
    const top = list[0].s;
    if (top > MATE - 100) return list[0].m;
    let pickM = list[0].m, pickS = -Infinity;
    for (const { m, s } of list) {
      if (s < top - style.noise) continue;
      const v = s + random() * style.noise;
      if (v > pickS) { pickS = v; pickM = m; }
    }
    return pickM;
  }
}

export function think(
  sfen: string,
  moves: string[],
  level: number,
  random: () => number = Math.random,
  now: () => number = () => performance.now(),
): string {
  const style = LITE_STYLES[Math.min(4, Math.max(1, Math.round(level)))];
  const pos = Pos.fromSfen(sfen);
  const seen = new Set<number>([pos.key]);
  for (const usi of moves) {
    pos.make(usiToMove(usi));
    seen.add(pos.key);
  }
  seen.delete(pos.key);
  const legal = pos.legalMoves(false);
  if (!legal.length) return 'resign';
  if (legal.length === 1) return moveToUsi(legal[0]);
  const search = new Search(pos, seen, style, now() + style.ms, now);
  return moveToUsi(search.root(legal, random));
}
