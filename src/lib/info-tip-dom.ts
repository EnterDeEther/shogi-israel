import { tipMarkup, type TipId } from './info-tips';

export function tipEl(id: TipId): HTMLElement {
  const t = document.createElement('template');
  t.innerHTML = tipMarkup(id);
  return t.content.firstElementChild as HTMLElement;
}
