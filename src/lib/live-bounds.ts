// Shogiground measures the board and the pieces in hand once and keeps those rectangles until the
// board is resized, the page scrolls or the window resizes. Our hands hide piece types with none left
// (learn.css: sg-hp-wrap[data-nb='0']), so when a type comes into or leaves the hand the others slide
// over but the hand keeps its size: the kept rectangles go stale and a press lands on the piece next
// to the one under the finger. The same happens to the board when text above it changes height.
// liveBounds() makes shogiground measure on every use instead (a handful of getBoundingClientRect calls).
import type { Api } from 'shogiground/api';
import type { Memo } from 'shogiground/types';

function live<A>(memo: Memo<A>): Memo<A> {
  const measure = (() => {
    memo.clear();
    return memo();
  }) as Memo<A>;
  measure.clear = () => {};
  return measure;
}

export function liveBounds<T extends Api>(ground: T): T {
  const bounds = ground.state.dom.bounds;
  bounds.board.bounds = live(bounds.board.bounds);
  bounds.hands.bounds = live(bounds.hands.bounds);
  bounds.hands.pieceBounds = live(bounds.hands.pieceBounds);
  return ground;
}
