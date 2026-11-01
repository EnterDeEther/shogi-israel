// Licensed under AGPL-3.0-or-later, like the rest of src/learn/.
import he from './i18n/he.json';

const strings: Record<string, string> = he;

export function i18n(key: string): string {
  const k = key.includes(':') ? key.slice(key.indexOf(':') + 1) : key;
  const s = strings[k];
  if (s === undefined) {
    if (import.meta.env.DEV) console.warn(`[learn i18n] missing key: ${key}`);
    return k;
  }
  return s;
}

export const hasKey = (key: string): boolean => strings[key.includes(':') ? key.slice(key.indexOf(':') + 1) : key] !== undefined;

export function i18nFormat(key: string, ...args: (string | number)[]): string {
  let i = 0;
  return i18n(key)
    .replace(/%(\d)\$s/g, (_m, n) => String(args[Number(n) - 1] ?? ''))
    .replace(/%s/g, () => String(args[i++] ?? ''));
}
