// AGPL-3.0-or-later, like the rest of this site.
import type { Api } from 'shogiground/api';
import { Shogiground } from 'shogiground/shogiground';
import type { Key } from 'shogiground/types';
import { makeSquareName, parseUsi } from 'shogiops/util';
import { el } from '../learn/view';
import { liveBounds } from '../lib/live-bounds';
import { SQUARE_RATIO } from '../lib/square-ratio';
import type { Color } from 'shogiops/types';

export function lastKeys(usi: string | null | undefined): Key[] {
  const md = usi ? parseUsi(usi) : undefined;
  if (!md) return [];
  return 'role' in md ? [makeSquareName(md.to)] : [makeSquareName(md.from), makeSquareName(md.to)];
}

const shown = new Map<string, { box: HTMLElement; ground: Api }>();

export function thumbBoard(id: string, sfen: string | null | undefined, you: Color | null, last?: string | null): HTMLElement | null {
  const board = sfen?.split(' ')[0];
  if (!board) return null;
  const view = { sfen: { board }, orientation: you === 'gote' ? 'gote' : 'sente', lastDests: lastKeys(last) } as const;
  const had = shown.get(id);
  if (had) {
    had.ground.set({ ...view, lastDests: [...view.lastDests] });
    return had.box;
  }
  const sg = el('div', { class: 'friend-thumb__sg' });
  const box = el('span', { class: 'friend-thumb play no-coords', dir: 'ltr', 'aria-hidden': 'true' }, sg);
  const ground = liveBounds(Shogiground({
    ...view,
    lastDests: [...view.lastDests],
    viewOnly: true,
    squareRatio: SQUARE_RATIO,
    coordinates: { enabled: false },
    highlight: { lastDests: true, check: false },
    drawable: { enabled: false, visible: false },
    animation: { enabled: false },
  }));
  ground.attach({ board: sg });
  shown.set(id, { box, ground });
  return box;
}
