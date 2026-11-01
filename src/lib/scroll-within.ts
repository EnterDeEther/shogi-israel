export function scrollWithin(box: HTMLElement, item: HTMLElement): void {
  const b = box.getBoundingClientRect();
  const r = item.getBoundingClientRect();
  if (r.top < b.top) box.scrollTop -= b.top - r.top;
  else if (r.bottom > b.bottom) box.scrollTop += r.bottom - b.bottom;
}
