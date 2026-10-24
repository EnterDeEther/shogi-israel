// Shogi Israel: lesson settings (the cog wheel), in place of lila's user prefs.
// Saved on this device only. The piece set (letters / kanji) is the site-wide html[data-pieces] switch, not stored here.
// AGPL-3.0-or-later, like the rest of src/learn/.
import { storage } from './storage';

export interface LearnPrefs {
  coords: boolean; // square numbers around the board
  dests: boolean; // dots on the squares a selected piece can go to
  animation: boolean;
  sound: boolean;
}

const KEY = 'learn.prefs';

const reducedMotion = (): boolean => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

export const defaults = (): LearnPrefs => ({
  coords: true,
  dests: true,
  animation: !reducedMotion(),
  sound: true,
});

export function loadPrefs(): LearnPrefs {
  const p = defaults();
  try {
    const saved = JSON.parse(storage.get(KEY) || '{}');
    for (const k of Object.keys(p) as (keyof LearnPrefs)[]) if (typeof saved[k] === 'boolean') p[k] = saved[k];
  } catch {
    /* broken or missing: defaults */
  }
  return p;
}

export function savePrefs(p: LearnPrefs): void {
  storage.set(KEY, JSON.stringify(p));
}
