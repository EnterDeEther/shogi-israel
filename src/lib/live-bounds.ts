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
