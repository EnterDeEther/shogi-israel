// AGPL-3.0-or-later, like the rest of this site.
import { el } from '../learn/view';

export const waiting = (...text: (HTMLElement | string)[]): HTMLElement =>
  el('span', { class: 'friend-waiting' }, el('span', { class: 'friend-dots', 'aria-hidden': 'true' }, el('i'), el('i'), el('i')), el('span', {}, ...text));
