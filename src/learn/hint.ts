import { shogigroundDropDests, shogigroundMoveDests } from 'shogiops/compat';
import { makeSfen } from 'shogiops/sfen';
import { makeUsi, parseSquareName, parseUsi } from 'shogiops/util';
import { pieceCanPromote, pieceForcePromote } from 'shogiops/variant/util';
import type { Level, UsiWithColor } from './interfaces';
import { illegalShogigroundDropDests, illegalShogigroundMoveDests } from './shogi';
import { currentPosition } from './util';

export function withOpponent(level: Level, list: UsiWithColor[]): UsiWithColor[] {
  const sc = level.scenario;
  const next = sc?.[list.length];
  if (sc && next && next.color !== level.color && onTrack(level, list)) return [...list, next];
  return list;
}

export function missedPromotion(level: Level, list: UsiWithColor[]): boolean {
  const own = list.filter((u) => u.color === level.color);
  const planned = level.scenario?.filter((u) => u.color === level.color)[own.length - 1]?.usi;
  return own.length > 0 && planned === `${own[own.length - 1].usi}+`;
}

function onTrack(level: Level, list: UsiWithColor[]): boolean {
  const sc = level.scenario;
  return !!sc && list.every((u, i) => sc[i]?.usi === u.usi && sc[i].color === u.color);
}

export function userMoves(level: Level, list: UsiWithColor[]): string[] {
  const pos = currentPosition(level, list);
  pos.turn = level.color;
  const illegal = !!level.offerIllegalDests || !!level.obstacles?.length;
  const moves = illegal ? illegalShogigroundMoveDests(pos) : shogigroundMoveDests(pos);
  const drops = illegal ? illegalShogigroundDropDests(pos) : shogigroundDropDests(pos);
  const out: string[] = [];
  for (const [from, dests] of moves) {
    const fromSq = parseSquareName(from)!;
    const piece = pos.board.get(fromSq)!;
    for (const to of dests) {
      const toSq = parseSquareName(to)!;
      const force = pieceForcePromote('standard')(piece, toSq);
      if (!force) out.push(makeUsi({ from: fromSq, to: toSq }));
      if (force || pieceCanPromote('standard')(piece, fromSq, toSq, undefined))
        out.push(makeUsi({ from: fromSq, to: toSq, promotion: true }));
    }
  }
  for (const [name, dests] of drops) {
    const role = name.split(' ')[1] as any;
    for (const to of dests) out.push(makeUsi({ role, to: parseSquareName(to)! }));
  }
  return out;
}

function enemyLeft(level: Level, l: UsiWithColor[]): number {
  const pos = currentPosition(level, l, true);
  return pos.board.color(level.color === 'sente' ? 'gote' : 'sente').size();
}

export function solve(level: Level, start: UsiWithColor[], moves: number, deadline = Infinity): string[] | undefined {
  const huntOnly = !/k/i.test(level.sfen.split(' ')[0]) && !level.scenario && !level.obstacles;
  const dead = new Set<string>();
  let out = false;
  const go = (list: UsiWithColor[], depth: number): UsiWithColor[] | undefined => {
    if (out || performance.now() > deadline) out = true;
    if (out) return undefined;
    const pos = currentPosition(level, list);
    const ranked = userMoves(level, list).map((usi) => ({ usi, cap: pos.board.has(parseSquareName(usi.slice(2, 4))!) ? 0 : usi[1] === '*' ? 2 : 1 }));
    ranked.sort((a, b) => a.cap - b.cap);
    for (const { usi } of ranked) {
      let l: UsiWithColor[];
      try {
        l = withOpponent(level, [...list, { usi, color: level.color }]);
        currentPosition(level, l);
      } catch {
        continue;
      }
      if (performance.now() > deadline) { out = true; return undefined; }
      if (level.success(level, l)) return l;
      if (level.failure?.(level, l)) continue;
      const left = moves - depth - 1;
      if (left <= 0) continue;
      const starsLeft = (level.obstacles ?? []).filter((o) => !l.some((u) => u.usi.slice(2, 4) === o)).length;
      if (starsLeft > left) continue;
      if (huntOnly && enemyLeft(level, l) > left) continue;
      const key = `${makeSfen(currentPosition(level, l))}|${left}`;
      if (dead.has(key)) continue;
      const r = go(l, depth + 1);
      if (r) return r;
      if (out) return undefined;
      dead.add(key);
    }
    return undefined;
  };
  return go(withOpponent(level, start), 0)?.slice(start.length).filter((u) => u.color === level.color).map((u) => u.usi);
}

function playsOut(level: Level, list: UsiWithColor[], line: string[]): boolean {
  let l = list;
  for (const usi of line) {
    if (!userMoves(level, l).includes(usi)) return false;
    l = withOpponent(level, [...l, { usi, color: level.color }]);
    if (level.success(level, l)) return true;
    if (level.failure?.(level, l)) return false;
  }
  return false;
}

function reverse(usi: string): string | undefined {
  const m = parseUsi(usi);
  if (!m || !('from' in m) || m.promotion) return undefined;
  return makeUsi({ from: m.to, to: m.from });
}

function collapse(moves: { usi: string; quiet: boolean }[]): { usi: string; quiet: boolean }[] {
  const out: { usi: string; quiet: boolean }[] = [];
  for (const m of moves) {
    const last = out[out.length - 1];
    if (last && last.quiet && m.quiet && reverse(last.usi) === m.usi) out.pop();
    else out.push(m);
  }
  return out;
}

function ownMoves(level: Level, list: UsiWithColor[]): { usi: string; quiet: boolean }[] {
  const out: { usi: string; quiet: boolean }[] = [];
  list.forEach((u, i) => {
    if (u.color !== level.color) return;
    const to = parseUsi(u.usi)!.to;
    out.push({ usi: u.usi, quiet: !currentPosition(level, list.slice(0, i)).board.has(to) });
  });
  return out;
}

function remaining(line: string[], mine: string[]): string[] {
  const rest = [...line];
  for (const u of mine) {
    const at = rest.indexOf(u);
    if (at >= 0) rest.splice(at, 1);
  }
  return rest;
}

function undo(mine: string[], known: string[]): string[] | undefined {
  let k = 0;
  while (k < mine.length && mine[k] === known[k]) k++;
  const back: string[] = [];
  for (const usi of mine.slice(k).reverse()) {
    const r = reverse(usi);
    if (!r) return undefined;
    back.push(r);
  }
  return back.length ? [...back, ...known.slice(k)] : undefined;
}

export function hintMove(level: Level, list: UsiWithColor[], known?: string[], ms = 1000): string | undefined {
  const own = ownMoves(level, list);
  const played = own.map((m) => m.usi);
  let mine = played;
  if (level.scenario && onTrack(level, list)) {
    const next = level.scenario[list.length];
    if (next?.color === level.color) return next.usi;
  }
  const line = known ?? level.line;
  if (line) {
    let k = 0;
    while (k < played.length && played[k] === line[k]) k++;
    mine = [...played.slice(0, k), ...collapse(own.slice(k)).map((m) => m.usi)];
    const rest = remaining(line, mine);
    if (rest.length && playsOut(level, list, rest)) return rest[0];
  }
  const deadline = performance.now() + ms;
  const base = Math.max(1, level.nbMoves - played.length);
  const search = (from: number, to: number, until: number): string | undefined => {
    for (let n = from; n <= to && performance.now() < until; n++) {
      const found = solve(level, list, n, until);
      if (found?.length) return found[0];
    }
    return undefined;
  };
  const quick = search(base, base + 1, performance.now() + ms * 0.3);
  if (quick) return quick;
  if (line) {
    const back = undo(mine, line);
    if (back && playsOut(level, list, back)) return back[0];
  }
  return search(base, base + 12, deadline);
}
