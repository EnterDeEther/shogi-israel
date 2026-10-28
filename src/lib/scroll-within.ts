// Scroll a list box so `item` is visible, moving only the box itself.
// el.scrollIntoView() also scrolls the page, which on phones pulled the board out of place
// after every move (the move list sits below the board there).
export function scrollWithin(box: HTMLElement, item: HTMLElement): void {
  const b = box.getBoundingClientRect();
  const r = item.getBoundingClientRect();
  if (r.top < b.top) box.scrollTop -= b.top - r.top;
  else if (r.bottom > b.bottom) box.scrollTop += r.bottom - b.bottom;
}
