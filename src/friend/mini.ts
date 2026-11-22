// AGPL-3.0-or-later, like the rest of this site.
import { el } from '../learn/view';

interface Cell { p: string; sente: boolean }

export function sfenCells(sfen: string): (Cell | null)[] {
  const cells: (Cell | null)[] = [];
  for (const row of sfen.split(' ')[0].split('/')) {
    let promoted = false;
    for (const ch of row) {
      if (ch === '+') { promoted = true; continue; }
      if (ch >= '1' && ch <= '9') { for (let i = 0; i < Number(ch); i++) cells.push(null); continue; }
      cells.push({ p: (promoted ? '+' : '') + ch.toUpperCase(), sente: ch !== ch.toLowerCase() });
      promoted = false;
    }
  }
  return cells.length === 81 ? cells : [];
}

export function lastSquares(usi: string | null | undefined): number[] {
  const at = (file: string, rank: string) => (rank.charCodeAt(0) - 97) * 9 + (9 - Number(file));
  const m = usi?.match(/^(?:([1-9])([a-i])|[A-Z]\*)([1-9])([a-i])\+?$/);
  if (!m) return [];
  const to = at(m[3], m[4]);
  return m[1] ? [at(m[1], m[2]), to] : [to];
}

export function miniBoard(sfen: string | null | undefined, you: Color | null, last?: string | null): HTMLElement | null {
  const cells = sfen ? sfenCells(sfen) : [];
  if (!cells.length) return null;
  const flip = you === 'gote';
  const marked = new Set(lastSquares(last));
  const squares = Array.from({ length: 81 }, (_, i) => {
    const at = flip ? 80 - i : i;
    const c = cells[at];
    const away = !!c && c.sente === flip;
    return el('span', { class: marked.has(at) ? 'mini-sq last' : 'mini-sq' },
      c ? el('span', { class: away ? 'pchip mini-away' : 'pchip', 'data-p': c.p }) : null);
  });
  return el('span', { class: 'friend-mini', dir: 'ltr', 'aria-hidden': 'true' }, ...squares);
}
