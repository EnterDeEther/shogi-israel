// A tip for screens drawn by script (the game, the puzzles, the learner home): the same markup the pages get
// from <InfoTip>, as an element to put inside el(...). The tips are in lib/info-tips.ts.
import { tipMarkup, type TipId } from './info-tips';

export function tipEl(id: TipId): HTMLElement {
  const t = document.createElement('template');
  t.innerHTML = tipMarkup(id);
  return t.content.firstElementChild as HTMLElement;
}
