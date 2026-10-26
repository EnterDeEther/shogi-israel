// Shogi Israel: stand-in for lila's `i18n` package.
// Keys keep Lishogi's names ("learn:theSilver" -> learn.xml <string name="theSilver">),
// so our Hebrew file is a drop-in replacement and upstream changes stay mergeable.
// Licensed under AGPL-3.0-or-later, like the rest of src/learn/.
import he from './i18n/he.json';

const strings: Record<string, string> = he;

/** Look up a string. "learn:theSilver" and "theSilver" both resolve; missing keys show the key, so gaps are visible. */
export function i18n(key: string): string {
  const k = key.includes(':') ? key.slice(key.indexOf(':') + 1) : key;
  const s = strings[k];
  if (s === undefined) {
    if (import.meta.env.DEV) console.warn(`[learn i18n] missing key: ${key}`);
    return k;
  }
  return s;
}

/** Same as lila's i18nFormat: replaces %s (and %1$s, %2$s...) in order. */
export function i18nFormat(key: string, ...args: (string | number)[]): string {
  let i = 0;
  return i18n(key)
    .replace(/%(\d)\$s/g, (_m, n) => String(args[Number(n) - 1] ?? ''))
    .replace(/%s/g, () => String(args[i++] ?? ''));
}
