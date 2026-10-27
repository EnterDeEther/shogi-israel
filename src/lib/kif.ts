// KIF game records: write a game as a KIF file, read one back, and hand it to the user
// (download, copy, open on Lishogi). One module for the whole site: the KIF viewer on /kif/
// uses it, and so does any page that plays a game (play vs AI, later private games).
//
// A game is stored as USI moves from a start SFEN, which is what shogiops and shogiground use.
// KIF is the Japanese text format every shogi app reads (Lishogi, 81Dojo, KENTO, Kifu for Windows).
// Moves look like "７六歩(77)": destination square in Japanese, piece, and the square it came from.
// We write UTF-8 with a "#KIF version=2.0 encoding=UTF-8" first line, as Lishogi does.

import { makeKifHeader, makeKifMoveOrDrop, normalizedKifLines, parseKifHeader, parseKifMoveOrDrop, parseTags } from 'shogiops/notation/kif';
import { initialSfen, makeSfen, parseSfen } from 'shogiops/sfen';
import type { Color, MoveOrDrop, Square } from 'shogiops/types';
import { makeSquareName, makeUsi, opposite, parseUsi } from 'shogiops/util';
import type { Position } from 'shogiops/variant/position';

export type KifEndReason =
  | 'resign' // 投了
  | 'checkmate' // 詰み
  | 'timeout' // 切れ負け
  | 'repetition' // 千日手
  | 'impasse' // 持将棋 (draw) or 入玉勝ち (win, with a winner)
  | 'illegal' // 反則負け
  | 'abort'; // 中断

export interface KifEnd {
  reason: KifEndReason;
  winner?: Color; // none = draw or unfinished
}

export interface KifGame {
  startSfen?: string; // default: the standard start position
  moves: string[]; // USI, e.g. ["7g7f", "3c3d", "P*5e"]
  sente?: string; // player names; in handicap games sente is 下手 (the weaker side, who moves second)
  gote?: string;
  date?: Date;
  event?: string;
  place?: string; // default: shogi.co.il
  end?: KifEnd;
}

export interface ParsedKif extends Required<Pick<KifGame, 'startSfen' | 'moves'>>, Omit<KifGame, 'startSfen' | 'moves'> {
  tags: [string, string][]; // every header line as it was in the file, e.g. ["棋戦", "..."]
  kifMoves: string[]; // the moves as written in the file, for the move list
}

export type KifResult = { ok: true; game: ParsedKif } | { ok: false; error: string; line?: number };

export const KIF_MIME = 'text/plain;charset=utf-8';
// Lishogi's "import game" page: paste KIF, CSA or USI and it opens the game with analysis.
export const LISHOGI_IMPORT_URL = 'https://lishogi.org/paste';

const STANDARD = initialSfen('standard');

// ---------- writing ----------

const END_WORD: Record<KifEndReason, string> = {
  resign: '投了',
  checkmate: '詰み',
  timeout: '切れ負け',
  repetition: '千日手',
  impasse: '持将棋',
  illegal: '反則負け',
  abort: '中断',
};

const pad = (n: number, w = 2) => String(n).padStart(w, '0');
const kifDate = (d: Date) =>
  `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

function startPosition(sfen: string | undefined): Position {
  return parseSfen('standard', sfen ?? STANDARD).unwrap();
}

/** True when gote moves first (handicap games): the KIF then names the players 下手 and 上手. */
const isHandicap = (pos: Position) => pos.turn === 'gote';

export function makeKif(game: KifGame): string {
  const pos = startPosition(game.startSfen);
  const handicap = isHandicap(pos);
  const out: string[] = ['#KIF version=2.0 encoding=UTF-8'];
  if (game.date) out.push(`開始日時：${kifDate(game.date)}`);
  if (game.event) out.push(`棋戦：${game.event}`);
  out.push(`場所：${game.place ?? 'shogi.co.il'}`);
  out.push(makeKifHeader(pos));
  out.push(`${handicap ? '下手' : '先手'}：${game.sente ?? ''}`);
  out.push(`${handicap ? '上手' : '後手'}：${game.gote ?? ''}`);
  out.push('手数----指手---------消費時間--');

  let lastDest: Square | undefined;
  game.moves.forEach((usi, i) => {
    const md = parseUsi(usi);
    if (!md || !pos.isLegal(md)) throw new Error(`makeKif: illegal move ${i + 1} (${usi})`);
    const kif = makeKifMoveOrDrop(pos, md, lastDest);
    out.push(`${String(i + 1).padStart(4)} ${kif}`);
    pos.play(md);
    lastDest = md.to;
  });

  const n = game.moves.length;
  if (game.end) {
    const { reason, winner } = game.end;
    const word = reason === 'impasse' && winner ? '入玉勝ち' : END_WORD[reason];
    out.push(`${String(n + 1).padStart(4)} ${word}`);
    const side = (c: Color) => (c === 'sente' ? (handicap ? '下手' : '先手') : handicap ? '上手' : '後手');
    if (winner) out.push(`まで${n}手で${side(winner)}の勝ち`);
    else if (reason === 'abort') out.push(`まで${n}手で中断`);
    else out.push(`まで${n}手で${END_WORD[reason]}`);
  }
  return `${out.join('\n')}\n`;
}

/** "shogi-israel-2026-10-24-2210.kif" */
export function kifFileName(game: Pick<KifGame, 'date'>, prefix = 'shogi-israel'): string {
  const d = game.date ?? new Date();
  return `${prefix}-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.kif`;
}

// ---------- reading ----------

// Spellings other programs use that shogiops' move regex does not: 王 for the king, one-kanji
// promoted pieces, 竜 for 龍, half-width digits in the destination.
const ALIASES: [RegExp, string][] = [
  [/王/g, '玉'],
  [/竜/g, '龍'],
  [/全/g, '成銀'],
  [/圭/g, '成桂'],
  [/杏/g, '成香'],
];
const FULL_DIGITS = '１２３４５６７８９';
function normalizeMove(s: string): string {
  let m = s.replace(/^([1-9])([一二三四五六七八九])/, (_, f: string, r: string) => FULL_DIGITS[Number(f) - 1] + r);
  for (const [re, to] of ALIASES) m = m.replace(re, to);
  return m;
}

// What a numbered line can say instead of a move: the game ended.
const END_WORDS: [RegExp, (mover: Color) => KifEnd][] = [
  [/^投了/, m => ({ reason: 'resign', winner: opposite(m) })],
  [/^詰み/, m => ({ reason: 'checkmate', winner: opposite(m) })],
  [/^(切れ負け|時間切れ)/, m => ({ reason: 'timeout', winner: opposite(m) })],
  [/^反則勝ち/, m => ({ reason: 'illegal', winner: m })],
  [/^反則負け/, m => ({ reason: 'illegal', winner: opposite(m) })],
  [/^(入玉勝ち|宣言勝ち)/, m => ({ reason: 'impasse', winner: m })],
  [/^持将棋/, () => ({ reason: 'impasse' })],
  [/^千日手/, () => ({ reason: 'repetition' })],
  [/^(中断|封じ手)/, () => ({ reason: 'abort' })],
];

const ERR = {
  empty: 'לא הודבק כלום. ⟦הדבק|הדביקי⟧ את תוכן קובץ ה־KIF או ⟦בחר|בחרי⟧ קובץ.',
  header: 'לא הצלחנו לקרוא את עמדת הפתיחה בקובץ.',
  move: (n: number, m: string) => `מהלך ${n} (${m}) לא נקרא. אולי הקובץ לא בפורמט KIF?`,
  illegal: (n: number, m: string) => `מהלך ${n} (${m}) לא חוקי בעמדה הזאת.`,
  noMoves: 'לא מצאנו מהלכים. בקובץ KIF כל מהלך מתחיל במספר, למשל: 1 ７六歩(77)',
  chushogi: 'הקובץ הזה הוא של וריאנט אחר (צ׳ו־שוגי או מיני־שוגי). אנחנו קוראים רק שוגי רגיל.',
};

function tagValue(tags: [string, string][], ...names: string[]): string | undefined {
  for (const n of names) {
    const v = tags.find(([k]) => k === n)?.[1]?.trim();
    if (v) return v;
  }
  return undefined;
}

function parseDate(s: string | undefined): Date | undefined {
  const m = s?.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})(?:\D+(\d{1,2})[:：](\d{2})(?:[:：](\d{2}))?)?/);
  if (!m) return undefined;
  const d = new Date(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0));
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/** Reads the main line of a KIF (variations after 変化 are skipped). Checks every move is legal. */
export function parseKif(text: string): KifResult {
  if (!text.trim()) return { ok: false, error: ERR.empty };
  const header = parseKifHeader(text);
  if (header.isErr) return { ok: false, error: ERR.header };
  const pos = header.value;
  if (pos.rules !== 'standard') return { ok: false, error: ERR.chushogi };
  const startSfen = makeSfen(pos);
  const tags = parseTags(text);
  const handicap = isHandicap(pos);

  const moves: string[] = [];
  const kifMoves: string[] = [];
  let end: KifEnd | undefined;
  let lastDest: Square | undefined;
  const lines = normalizedKifLines(text);
  for (const [i, line] of lines.entries()) {
    if (line.startsWith('変化')) break;
    const m = line.match(/^(\d+)\s+(\S+(?:\s(?=[^\s(]*\())?\S*)/);
    if (!m) continue;
    const raw = m[2].replace(/\s/g, '').replace(/\+$/, '');
    const n = moves.length + 1;
    const ending = END_WORDS.find(([re]) => re.test(raw));
    if (ending) {
      end = ending[1](pos.turn);
      break;
    }
    const md: MoveOrDrop | undefined = parseKifMoveOrDrop(normalizeMove(raw), lastDest);
    if (!md) return { ok: false, error: ERR.move(n, raw), line: i + 1 };
    if (!pos.isLegal(md)) return { ok: false, error: ERR.illegal(n, raw), line: i + 1 };
    kifMoves.push(raw);
    moves.push(makeUsi(md));
    pos.play(md);
    lastDest = md.to;
  }
  if (!moves.length && !end && !lines.some(l => /^手数/.test(l))) return { ok: false, error: ERR.noMoves };

  return {
    ok: true,
    game: {
      startSfen,
      moves,
      kifMoves,
      tags,
      sente: tagValue(tags, handicap ? '下手' : '先手', '先手', '下手'),
      gote: tagValue(tags, handicap ? '上手' : '後手', '後手', '上手'),
      date: parseDate(tagValue(tags, '開始日時', '対局日')),
      event: tagValue(tags, '棋戦'),
      place: tagValue(tags, '場所'),
      end,
    },
  };
}

/** Every position of a game, start first: positions[i] is the board after i moves. */
export function gamePositions(game: Pick<KifGame, 'startSfen' | 'moves'>): Position[] {
  const pos = startPosition(game.startSfen);
  const out = [pos.clone()];
  for (const usi of game.moves) {
    pos.play(parseUsi(usi)!);
    out.push(pos.clone());
  }
  return out;
}

/** Western notation with our square names (two digits): "P-76", "Sx34", "B*55", "+R-28", "S-43+". */
export function westernMove(pos: Position, usi: string): string {
  const md = parseUsi(usi);
  if (!md) return usi;
  // shogiops names squares like "7f"; we write file then rank as two digits, "76"
  const sq = (s: Square) => { const n = makeSquareName(s); return `${n[0]}${n.charCodeAt(1) - 96}`; };
  if ('role' in md) return `${LETTER[md.role]}*${sq(md.to)}`;
  const piece = pos.board.get(md.from);
  const letter = piece ? LETTER[piece.role] : '?';
  const sep = pos.board.has(md.to) ? 'x' : '-';
  return `${letter}${sep}${sq(md.to)}${md.promotion ? '+' : ''}`;
}
const LETTER: Record<string, string> = {
  king: 'K', rook: 'R', bishop: 'B', gold: 'G', silver: 'S', knight: 'N', lance: 'L', pawn: 'P',
  dragon: '+R', horse: '+B', promotedsilver: '+S', promotedknight: '+N', promotedlance: '+L', tokin: '+P',
};

/** Hebrew line for how the game ended, or undefined if it is still going. */
export function endText(end: KifEnd | undefined, handicap = false): string | undefined {
  if (!end) return undefined;
  const who = (c: Color) => (c === 'sente' ? (handicap ? 'מקבל הפור' : 'הפותח') : handicap ? 'נותן הפור' : 'המשיב');
  const r: Record<KifEndReason, string> = {
    resign: 'כניעה',
    checkmate: 'מט',
    timeout: 'הפסד בזמן',
    repetition: 'חזרה מרובעת',
    impasse: 'מבוי סתום',
    illegal: 'מהלך לא חוקי',
    abort: 'המשחק הופסק',
  };
  if (end.winner) return `ניצחון ל${who(end.winner)}: ${r[end.reason]}`;
  return end.reason === 'abort' ? r.abort : `תיקו: ${r[end.reason]}`;
}

// ---------- handing the file to the user (browser only) ----------

export function downloadKif(text: string, fileName: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: KIF_MIME }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Reads a .kif/.kifu file. Old .kif files are Shift_JIS; .kifu and Lishogi's files are UTF-8. */
export async function readKifFile(file: Blob): Promise<string> {
  const buf = await file.arrayBuffer();
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf).replace(/^﻿/, '');
  } catch {
    return new TextDecoder('shift_jis').decode(buf);
  }
}
