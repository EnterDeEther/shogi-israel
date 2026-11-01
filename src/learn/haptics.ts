// One switch, prefs.haptics (the cog wheel and /account/), default on. AGPL-3.0-or-later, like the rest of src/learn/.
import type { SoundName } from './sound';
import { loadPrefs } from './prefs';

const PATTERN: Record<SoundName, number[]> = {
  move: [12],
  drop: [18],
  capture: [16, 45, 22],
  promote: [12, 50, 26],
  check: [28, 50, 28],
  tap: [8],
  toggle: [8],
  start: [10],
  success: [14, 70, 14],
  solved: [14, 70, 14, 70, 24],
  fail: [45, 60, 45, 60, 45],
  end: [14, 70, 14, 70, 30],
  gameStart: [16, 90, 16],
  win: [14, 70, 14, 70, 40],
  lose: [70],
  points: [12],
  rank: [16, 70, 16, 70, 50],
};

const IOS_GAP = 110;

const coarse = (): boolean => {
  try {
    return matchMedia('(pointer: coarse)').matches;
  } catch {
    return false;
  }
};
const canVibrate = (): boolean => typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

export const hapticsSupported = (): boolean => typeof window !== 'undefined' && coarse();

let on: boolean | undefined;
export function applyHaptics(value: boolean): void {
  on = value;
}

let sw: HTMLLabelElement | undefined;
function iosTick(): void {
  if (!sw) {
    sw = document.createElement('label');
    sw.setAttribute('aria-hidden', 'true');
    sw.dataset.haptic = '';
    sw.style.cssText = 'position:fixed;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;inset-inline-start:-9999px';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    input.tabIndex = -1;
    sw.append(input);
    sw.addEventListener('click', (e) => e.stopPropagation());
    document.body.append(sw);
  }
  sw.click();
}

const last = new Map<SoundName, number>();

export function buzz(name: SoundName): void {
  if (!hapticsSupported() || document.hidden) return;
  if (!(on ??= loadPrefs().haptics)) return;
  const now = performance.now();
  if (now - (last.get(name) ?? -1e9) < 60) return;
  last.set(name, now);
  const pattern = PATTERN[name];
  if (canVibrate()) {
    const ua = (navigator as any).userActivation;
    if (ua && !ua.hasBeenActive) return;
    try {
      navigator.vibrate(pattern);
    } catch {
    }
    return;
  }
  const ticks = Math.ceil(pattern.length / 2);
  for (let i = 0; i < ticks; i++) {
    if (i === 0) iosTick();
    else setTimeout(iosTick, i * IOS_GAP);
  }
}
