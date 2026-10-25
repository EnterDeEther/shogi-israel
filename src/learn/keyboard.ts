// Shogi Israel: keyboard play for the lesson board and the game against the computer (shogiground is pointer-only). IS 5568 / WCAG 2.1.1.
// Tab to the board, then:
//   arrows      move the cursor (as you see the board; works when it is turned for the second player)
//   two digits  jump to a square: 7 then 6 = square 76
//   Enter/Space pick up the piece under the cursor, or move/drop to the cursor
//   D           take a piece from your hand (press again for the next one)
//   + / -       in the promotion question: promote / don't promote
//   Esc         drop the selection
//   ?           say these keys
// Every step is announced in a polite live region, in Hebrew, with two-digit squares (76).
// AGPL-3.0-or-later, like the rest of src/learn/.
import type { Api } from 'shogiground/api';
import type { Piece } from 'shogiground/types';
import { i18n, i18nFormat } from './i18n';

const pieceNames: Record<string, string> = {
  king: 'מלך',
  rook: 'צריח',
  bishop: 'רץ',
  gold: 'גנרל זהב',
  silver: 'גנרל כסף',
  knight: 'פרש',
  lance: 'רומח',
  pawn: 'רגלי',
  dragon: 'דרקון',
  horse: 'סוס',
  promotedsilver: 'כסף מוכתר',
  promotedknight: 'פרש מוכתר',
  promotedlance: 'רומח מוכתר',
  tokin: 'טוקין',
};
export const pieceName = (role: string): string => pieceNames[role] ?? role;

const RANKS = 'abcdefghi';
/** shogiground key "7f" -> our square name "76" */
export const squareName = (key: string): string => `${key[0]}${RANKS.indexOf(key[1]) + 1}`;
const keyOf = (file: number, rank: number): Key => `${file}${RANKS[rank - 1]}` as Key;

/** What the keyboard needs from its page: the lesson controller, or the game against the computer. */
export interface KeyboardHost {
  shogiground: Api;
  vm?: { level: { color: Color } };
}

export function attachKeyboard(ctrl: KeyboardHost, boardEl: HTMLElement, cursorEl: HTMLElement, live: HTMLElement): void {
  const sg = () => ctrl.shogiground;
  let cursor: Key | undefined;
  let digits = '';
  let digitTimer: number | undefined;

  const say = (text: string) => {
    // Clear first so the same sentence twice is still read.
    live.textContent = '';
    window.setTimeout(() => {
      live.textContent = text;
    }, 30);
  };

  const myColor = (): Color => ctrl.vm?.level.color ?? 'sente';

  // visual column (0 = left) and row (0 = top) of a square, for the current orientation
  const toVisual = (k: Key): [number, number] => {
    const file = Number(k[0]);
    const rank = RANKS.indexOf(k[1]) + 1;
    return sg().state.orientation === 'gote' ? [file - 1, 9 - rank] : [9 - file, rank - 1];
  };
  const fromVisual = (c: number, r: number): Key =>
    sg().state.orientation === 'gote' ? keyOf(c + 1, 9 - r) : keyOf(9 - c, r + 1);

  const placeCursor = () => {
    if (!cursor) return;
    const [c, r] = toVisual(cursor);
    cursorEl.style.left = `${(c * 100) / 9}%`;
    cursorEl.style.top = `${(r * 100) / 9}%`;
  };

  const describe = (k: Key): string => {
    const s = sg().state;
    const parts = [squareName(k)];
    const p = s.pieces.get(k);
    if (p) parts.push(`${pieceName(p.role)} ${p.color === myColor() ? 'שלכם' : 'של היריב'}`);
    else if (s.drawable.squares?.some((h) => h.key === k && h.className?.includes('star'))) parts.push('כוכב');
    else parts.push('ריקה');
    const dests = s.selected
      ? s.movable.dests?.get(s.selected)
      : s.selectedPiece
        ? s.droppable.dests?.get(`${s.selectedPiece.color} ${s.selectedPiece.role}`)
        : undefined;
    if (dests?.includes(k)) parts.push('אפשר להגיע לכאן');
    if (s.selected === k) parts.push('נבחר');
    return parts.join(', ');
  };

  const firstOwnPiece = (): Key | undefined => {
    for (const [k, p] of sg().state.pieces) if (p.color === myColor()) return k;
    return undefined;
  };

  const help = () => say(i18n('il_kbdHelp'));

  boardEl.addEventListener('focus', () => {
    if (!cursor || !sg().state.pieces) cursor = sg().state.selected ?? firstOwnPiece() ?? ('5e' as Key);
    placeCursor();
    say(`${describe(cursor)}. ${i18n('il_kbdHint')}`);
  });

  const promotionOpen = () => !!sg().state.promotion.current;
  const answerPromotion = (prom: boolean) => {
    const cur = sg().state.promotion.current;
    if (!cur) return;
    // Same as shogiground's own click on a promotion choice (events.ts promote()).
    sg().selectSquare(cur.key, prom);
    sg().state.promotion.current = undefined;
    sg().state.dom.redraw();
  };

  const activate = () => {
    if (!cursor) return;
    if (promotionOpen()) return answerPromotion(true);
    const s = sg().state;
    // shogiground only opens the promotion question for pointer events; open it here the same way
    // (board.ts basePromotionDialog), so mouse users can still answer it on screen.
    const orig = s.selected;
    const piece = orig && s.pieces.get(orig);
    if (orig && piece && s.movable.dests?.get(orig)?.includes(cursor) && s.promotion.movePromotionDialog(orig, cursor)) {
      const role = s.promotion.promotesTo(piece.role);
      if (role) {
        s.promotion.current = { piece, promotedPiece: { color: piece.color, role }, key: cursor, dragged: false };
        s.hovered = cursor;
        s.dom.redraw();
        return say(i18n('il_kbdPromote'));
      }
    }
    const before = s.lastDests?.join();
    sg().selectSquare(cursor);
    if (s.lastDests?.join() !== before) return; // a move or drop happened; the goal / result line speaks next
    if (s.selected === cursor) say(`${i18n('il_kbdPicked')} ${describe(cursor)}`);
    else say(describe(cursor));
  };

  const cycleHand = () => {
    const s = sg().state;
    const hand = s.hands.handMap.get(myColor());
    const roles = s.hands.roles.filter((r) => (hand?.get(r) ?? 0) > 0);
    if (!roles.length) return say(i18n('il_kbdHandEmpty'));
    const cur = s.selectedPiece?.color === myColor() ? roles.indexOf(s.selectedPiece.role) : -1;
    const role = roles[(cur + 1) % roles.length];
    const piece: Piece = { role, color: myColor() };
    sg().selectPiece(piece);
    say(i18nFormat('il_kbdFromHand', pieceName(role), hand?.get(role) ?? 0));
  };

  boardEl.addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    let handled = true;
    const move = (dc: number, dr: number) => {
      if (!cursor) return;
      const [c, r] = toVisual(cursor);
      cursor = fromVisual(Math.min(8, Math.max(0, c + dc)), Math.min(8, Math.max(0, r + dr)));
      placeCursor();
      say(describe(cursor));
    };
    switch (e.key) {
      case 'ArrowLeft': move(-1, 0); break;
      case 'ArrowRight': move(1, 0); break;
      case 'ArrowUp': move(0, -1); break;
      case 'ArrowDown': move(0, 1); break;
      case 'Enter':
      case ' ':
        activate();
        break;
      case '+':
      case '=':
        if (promotionOpen()) answerPromotion(true);
        else handled = false;
        break;
      case '-':
        if (promotionOpen()) answerPromotion(false);
        else handled = false;
        break;
      case 'Escape':
        if (promotionOpen()) {
          sg().state.promotion.current = undefined;
          sg().selectSquare(null);
        } else if (sg().state.selected || sg().state.selectedPiece) {
          sg().selectSquare(null);
          sg().selectPiece(null);
        } else handled = false;
        if (handled) say(i18n('il_kbdCancelled'));
        break;
      case '?':
        help();
        break;
      default:
        if (e.code === 'KeyD') cycleHand();
        else if (/^[1-9]$/.test(e.key)) {
          digits += e.key;
          window.clearTimeout(digitTimer);
          if (digits.length === 2) {
            cursor = keyOf(Number(digits[0]), Number(digits[1]));
            digits = '';
            placeCursor();
            say(describe(cursor));
          } else digitTimer = window.setTimeout(() => (digits = ''), 1500);
        } else handled = false;
    }
    if (handled) e.preventDefault();
  });

  // Keep the cursor on the right square when the board turns (orientation follows the player's colour).
  document.addEventListener('learn-level', () => {
    if (cursor && !sg().state.pieces.get(cursor)) cursor = firstOwnPiece() ?? cursor;
    placeCursor();
  });
}
