import type { Position } from 'shogiops/variant/position';
import { makeSquareName, parseSquareName, parseUsi } from 'shogiops/util';
import type { Role } from 'shogiops/types';
import type { DrawShape } from 'shogiground/draw';
import { parseSfen } from 'shogiops/sfen';
import type { IncompleteLevel, Level, UsiWithColor } from './interfaces';
import { arrow, circle } from './shapes';

const NAME: Record<string, string> = {
  king: 'מלך', rook: 'צריח', bishop: 'רץ', gold: 'זהב', silver: 'כסף', knight: 'פרש', lance: 'רומח', pawn: 'חייל',
  dragon: 'דרקון', horse: 'סוס', tokin: 'טוקין',
  promotedsilver: 'כסף מוכתר', promotedknight: 'פרש מוכתר', promotedlance: 'רומח מוכתר',
};
const PROMOTED: Partial<Record<Role, Role>> = {
  rook: 'dragon', bishop: 'horse', pawn: 'tokin', silver: 'promotedsilver', knight: 'promotedknight', lance: 'promotedlance',
};
const COUNT = ['', 'משבצת אחת', 'שתי משבצות', 'שלוש משבצות', 'ארבע משבצות', 'חמש משבצות', 'שש משבצות', 'שבע משבצות', 'שמונה משבצות'];

const def = (name: string) => name.split(' ').map((w) => `ה${w}`).join(' ');
const file = (key: string) => Number(key[0]);
const rank = (key: string) => 'abcdefghi'.indexOf(key[1]) + 1;

export interface MoveText {
  order: string;
  done: string;
}

function motion(from: string, to: string, mine: boolean, sente: boolean, role: string): string {
  const fwd = (sente ? rank(from) - rank(to) : rank(to) - rank(from));
  const left = sente ? file(to) - file(from) : file(from) - file(to);
  const viewLeft = file(to) - file(from);
  const up = mine ? 'קדימה' : 'לכיוונך';
  const down = mine ? 'אחורה' : 'אחורה, הרחק ממך';
  const side = (mine ? left : viewLeft) > 0 ? 'שמאלה' : 'ימינה';
  if (role === 'knight') return `בקפיצה קדימה ו${side}`;
  const n = Math.max(Math.abs(fwd), Math.abs(left));
  const steps = role === 'pawn' && n === 1 ? 'צעד אחד' : COUNT[n];
  if (left === 0) return `${steps} ${fwd > 0 ? up : down}`;
  if (fwd === 0) return `${steps} ${side}`;
  return `${steps} באלכסון ${fwd > 0 ? up : 'אחורה'} ו${side}`;
}

const ORDINAL = ['', 'הראשון', 'השני', 'השלישי', 'הרביעי', 'החמישי', 'השישי', 'השביעי', 'השמיני', 'התשיעי'];
const ORDINAL_F = ['', 'הראשונה', 'השנייה', 'השלישית', 'הרביעית', 'החמישית', 'השישית', 'השביעית', 'השמינית', 'התשיעית'];

function pairSide(pos: Position, sq: number): string | undefined {
  const piece = pos.board.get(sq)!;
  const twins = [...pos.board.pieces(piece.color, piece.role)];
  if (twins.length !== 2) return undefined;
  const other = makeSquareName(twins.find((s) => s !== sq)!);
  const here = makeSquareName(sq);
  return (piece.color === 'sente' ? file(here) < file(other) : file(here) > file(other)) ? 'הימני' : 'השמאלי';
}

function ownName(pos: Position, sq: number): string {
  const piece = pos.board.get(sq)!;
  const side = pairSide(pos, sq);
  return def(NAME[piece.role]) + (side ? ` ${side}` : '');
}

function columnFromRight(key: string, sente: boolean): number {
  return sente ? file(key) : 10 - file(key);
}

function behind(pos: Position, key: string, color: 'sente' | 'gote'): number | undefined {
  const f = file(key);
  const r = rank(key);
  const step = color === 'sente' ? 1 : -1;
  for (let rr = r + step; rr >= 1 && rr <= 9; rr += step) {
    const sq = parseSquareName(`${f}${'abcdefghi'[rr - 1]}` as Key)!;
    const p = pos.board.get(sq);
    if (p && p.color === color) return sq;
  }
  return undefined;
}

function blocksBishop(pos: Position, key: string, color: 'sente' | 'gote'): boolean {
  const bishops = [...pos.board.pieces(color, 'bishop')];
  return bishops.some((b) => {
    const bk = makeSquareName(b);
    const df = file(key) - file(bk);
    const dr = rank(key) - rank(bk);
    if (Math.abs(df) !== Math.abs(dr) || df === 0) return false;
    const n = Math.abs(df);
    for (let i = 1; i < n; i++) {
      const k = `${file(bk) + Math.sign(df) * i}${'abcdefghi'[rank(bk) + Math.sign(dr) * i - 1]}` as Key;
      if (pos.board.has(parseSquareName(k)!)) return false;
    }
    return (color === 'sente' ? dr < 0 : dr > 0);
  });
}

function pawnName(pos: Position, sq: number): string {
  const key = makeSquareName(sq);
  const color = pos.board.get(sq)!.color;
  const sente = color === 'sente';
  const back = behind(pos, key, color);
  const backRole = back !== undefined ? pos.board.get(back)!.role : undefined;
  if (backRole === 'rook') return 'החייל שלפני הצריח';
  const col = columnFromRight(key, sente);
  if (col === 1) return 'החייל שבקצה הימני';
  if (col === 9) return 'החייל שבקצה השמאלי';
  if (blocksBishop(pos, key, color)) return 'החייל שחוסם את האלכסון של הרץ';
  if (backRole === 'king') return 'החייל שלפני המלך';
  if (back !== undefined) return `החייל שלפני ${ownName(pos, back)}`;
  return `החייל שבטור ${ORDINAL[col]} מימין`;
}

function which(pos: Position, fromSq: number, mine: boolean): string {
  const piece = pos.board.get(fromSq)!;
  const name = NAME[piece.role];
  if (!mine) {
    const twins = [...pos.board.pieces(piece.color, piece.role)];
    if (twins.length !== 2) return def(name) + ' שלו';
    const other = makeSquareName(twins.find((s) => s !== fromSq)!);
    return `${def(name)} שלו, זה שמצד ${file(makeSquareName(fromSq)) < file(other) ? 'ימין' : 'שמאל'} של הלוח,`;
  }
  if (piece.role === 'pawn') {
    const name = pawnName(pos, fromSq);
    const clash = [...pos.board.pieces(piece.color, 'pawn')].some((p) => p !== fromSq && pawnName(pos, p) === name);
    return clash ? `החייל שבטור ${ORDINAL[columnFromRight(makeSquareName(fromSq), piece.color === 'sente')]} מימין` : name;
  }
  const twins = [...pos.board.pieces(piece.color, piece.role)];
  if (twins.length <= 2) return ownName(pos, fromSq);
  return `${def(name)} שבטור ${ORDINAL[columnFromRight(makeSquareName(fromSq), piece.color === 'sente')]} מימין`;
}

function dropTarget(pos: Position, key: string, color: 'sente' | 'gote'): string {
  if (key === '5e') return 'למשבצת שבאמצע הלוח';
  const back = behind(pos, key, color);
  if (back !== undefined) {
    const gap = Math.abs(rank(makeSquareName(back)) - rank(key));
    const who = pos.board.get(back)!.role === 'pawn' ? pawnName(pos, back) : ownName(pos, back);
    return gap === 1 ? `למשבצת הריקה שישר לפני ${who}` : `לטור של ${who}, ${COUNT[gap]} לפניו`;
  }
  const sente = color === 'sente';
  const row = sente ? 10 - rank(key) : rank(key);
  return `לטור ${ORDINAL[columnFromRight(key, sente)]} מימין, בשורה ${ORDINAL_F[row]} מלמטה`;
}

export function describeMove(pos: Position, usi: string, mine: boolean): MoveText {
  const move = parseUsi(usi)!;
  const sente = pos.turn === 'sente';
  if ('role' in move) {
    const name = NAME[move.role];
    return mine
      ? { order: `⟦הצנח|הצניחי⟧ ${name} מהיד ${dropTarget(pos, makeSquareName(move.to), pos.turn)}.`, done: `${name} מהיד הוצנח ללוח.` }
      : { order: '', done: `${name} מהיד הוצנח ללוח.` };
  }
  const piece = pos.board.get(move.from)!;
  const from = makeSquareName(move.from);
  const to = makeSquareName(move.to);
  const who = which(pos, move.from, mine);
  const pick = who;
  const how = motion(from, to, mine, sente, piece.role);
  const victim = pos.board.get(move.to);
  const prom = move.promotion ? PROMOTED[piece.role] : undefined;
  const take = victim ? NAME[victim.role] : '';
  if (mine) {
    const order = victim
      ? `⟦לכוד|לכדי⟧ עם ${pick} את ${def(take)} של היריב: ${how}.`
      : `⟦הזז|הזיזי⟧ את ${pick} ${how}.`;
    const crown = prom ? ` כשהלוח שואל, ⟦בחר|בחרי⟧ להכתיר, והוא יהפוך ל${NAME[prom]}.` : '';
    const done = victim ? `${who} לוכד את ${def(take)} של היריב` : `${who} זז ${how}`;
    return { order: order + crown, done: `${done}${prom ? `, ומוכתר ל${NAME[prom]}` : ''}.` };
  }
  const done = victim
    ? `${who} לוכד את ${def(take)} שלך`
    : `${who} זז ${how}`;
  return { order: '', done: `${done}${prom ? `, ומוכתר ל${NAME[prom]}` : ''}.` };
}

const hints = new WeakMap<Level, number>();

export function showHint(level: Level, usiCList: UsiWithColor[]): void {
  hints.set(level, usiCList.length);
}

export function hintShown(level: Level, usiCList: UsiWithColor[]): boolean {
  return hints.get(level) === usiCList.length;
}

export function nextMoveShapes(level: Level, usiCList: UsiWithColor[]): DrawShape[] {
  return hintShown(level, usiCList) ? hintShapes(level, usiCList) : [];
}

export function hintShapes(level: Level, usiCList: UsiWithColor[]): DrawShape[] {
  const sc = level.scenario;
  if (!sc) return [];
  const i = usiCList.length;
  const next = sc[i];
  if (!next || next.color !== level.color) return [];
  if (usiCList.some((u, j) => sc[j]?.usi !== u.usi)) return [];
  const move = parseUsi(next.usi)!;
  const to = makeSquareName(move.to);
  return 'role' in move ? [circle(to)] : [arrow(makeSquareName(move.from), to)];
}

export function nextOrder(level: Level, usiCList: UsiWithColor[]): string | undefined {
  const sc = level.scenario;
  if (!sc || !level.moveOrders) return undefined;
  const i = usiCList.length;
  if (!sc[i] || sc[i].color !== level.color) return undefined;
  if (usiCList.some((u, j) => sc[j]?.usi !== u.usi)) return undefined;
  return level.moveOrders[sc.slice(0, i).filter((u) => u.color === level.color).length];
}

export function describeLine(pos: Position, usis: string[], mineFirst = true): { orders: string[]; done: string[]; replies: string[] } {
  const orders: string[] = [];
  const done: string[] = [];
  const replies: string[] = [];
  usis.forEach((u, i) => {
    const mine = (i % 2 === 0) === mineFirst;
    const t = describeMove(pos, u, mine);
    if (mine) { orders.push(t.order); done.push(t.done); } else replies.push(t.done);
    pos.play(parseUsi(u)!);
  });
  return { orders, done, replies };
}

export function pieceList(pos: Position, squares: number[]): string {
  const names = squares.map((sq) => which(pos, sq, true));
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} ו${names[names.length - 1]}` : names.join('');
}

export function withGuide(l: IncompleteLevel): IncompleteLevel {
  const pos = parseSfen('standard', l.sfen, false).unwrap();
  const text = describeLine(pos, l.scenario!.map((u) => u.usi));
  return { ...l, drawShapes: nextMoveShapes, moveOrders: text.orders, moveNames: text.done, replyNames: text.replies };
}
