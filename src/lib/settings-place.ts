export const PHONE_SETTINGS = '/app/#settings';
export const DESKTOP_SETTINGS = '/settings/';

export const isPhoneLike = (): boolean =>
  matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true ||
  matchMedia('(pointer: coarse)').matches;

export const settingsHref = (): string => (isPhoneLike() ? PHONE_SETTINGS : DESKTOP_SETTINGS);

export function pointSettingsLinks(root: ParentNode = document) {
  const href = settingsHref();
  root.querySelectorAll<HTMLAnchorElement>('a[data-settings-link]').forEach((a) => { a.href = href; });
}
