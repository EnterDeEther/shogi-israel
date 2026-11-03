import type { Position } from 'shogiops/variant/position';
import { makeSquareName, parseUsi } from 'shogiops/util';
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

function which(pos: Position, fromSq: number, mine: boolean, order = false): string {
  const piece = pos.board.get(fromSq)!;
  const name = NAME[piece.role];
  const own = mine ? '' : ' שלו';
  const twins = [...pos.board.pieces(piece.color, piece.role)];
  if (twins.length === 1) return def(name) + own;
  if (twins.length > 2) return `${def(name)}${own}${order ? ' שהחץ מראה' : ''}`;
  const other = makeSquareName(twins.find((s) => s !== fromSq)!);
  const here = makeSquareName(fromSq);
  const rightSide = piece.color === 'sente' ? file(here) < file(other) : file(here) > file(other);
  if (mine) return `${def(name)} ${rightSide ? 'הימני' : 'השמאלי'}`;
  return `${def(name)} שלו, זה שמצד ${file(here) < file(other) ? 'ימין' : 'שמאל'} של הלוח,`;
}

export function describeMove(pos: Position, usi: string, mine: boolean): MoveText {
  const move = parseUsi(usi)!;
  const sente = pos.turn === 'sente';
  if ('role' in move) {
    const name = NAME[move.role];
    return mine
      ? { order: `⟦הצנח|הצניחי⟧ ${name} מהיד למשבצת שמסומנת בעיגול.`, done: `${name} מהיד הוצנח ללוח.` }
      : { order: '', done: `${name} מהיד הוצנח ללוח.` };
  }
  const piece = pos.board.get(move.from)!;
  const from = makeSquareName(move.from);
  const to = makeSquareName(move.to);
  const who = which(pos, move.from, mine);
  const pick = which(pos, move.from, mine, true);
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

export function nextMoveShapes(level: Level, usiCList: UsiWithColor[]): DrawShape[] {
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
  const pawns = squares.filter((sq) => pos.board.get(sq)?.role === 'pawn').length;
  const names = [...new Set(squares.map((sq) => which(pos, sq, true)))].map((n) =>
    n === 'החייל' && pawns > 1 ? `${['', '', 'שני', 'שלושת', 'ארבעת'][pawns] ?? pawns} החיילים` : n);
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} ו${names[names.length - 1]}` : names.join('');
}

export function withGuide(l: IncompleteLevel): IncompleteLevel {
  const pos = parseSfen('standard', l.sfen, false).unwrap();
  const text = describeLine(pos, l.scenario!.map((u) => u.usi));
  return { ...l, drawShapes: nextMoveShapes, moveOrders: text.orders, moveNames: text.done, replyNames: text.replies };
}
