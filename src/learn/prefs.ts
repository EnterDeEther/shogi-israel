// AGPL-3.0-or-later, like the rest of src/learn/.
import { storage } from './storage';

export interface LearnPrefs {
  coords: boolean;
  dests: boolean;
  animation: boolean;
  sound: boolean;
  vol: number;
  sndBoard: boolean;
  sndGame: boolean;
  sndLessons: boolean;
  sndProgress: boolean;
  sndUi: boolean;
  haptics: boolean;
}

export type SwitchPref = Exclude<keyof LearnPrefs, 'vol'>;

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
  vol: 0.8,
  sndBoard: true,
  sndGame: true,
  sndLessons: true,
  sndProgress: true,
  sndUi: true,
  haptics: true,
});

export function loadPrefs(): LearnPrefs {
  const p = defaults();
  try {
    const saved = JSON.parse(storage.get(KEY) || '{}');
    for (const k of Object.keys(p) as (keyof LearnPrefs)[]) if (typeof saved[k] === typeof p[k]) (p as any)[k] = saved[k];
    p.vol = Math.min(1, Math.max(0, p.vol));
  } catch {
  }
  return p;
}

export function savePrefs(p: LearnPrefs): void {
  storage.set(KEY, JSON.stringify(p));
}
