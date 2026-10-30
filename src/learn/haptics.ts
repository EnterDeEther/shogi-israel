// Shogi Israel: haptic feedback (a short buzz in the hand) for the same moments that make a sound (src/learn/sound.ts
// calls buzz() from play()). Works without sound: the phone can be on silent and still tick on each move.
// Android (Chrome, Firefox, Samsung Internet): navigator.vibrate with a short pattern per kind of moment.
// iPhone: Safari has no vibrate, but since iOS 17.4 tapping a switch (<input type="checkbox" switch>) gives the system
// haptic tick, and iOS 18 lets a page click one from code. So we keep one hidden switch and click it, once per pulse.
// It only works inside or right after a tap, which is when every buzz here happens (the computer's reply on /play/
// may stay quiet on iPhone). iPads, computers and older iPhones have nothing to buzz, and the setting is hidden there.
// One switch, prefs.haptics (the cog wheel and /account/), default on. AGPL-3.0-or-later, like the rest of src/learn/.
import type { SoundName } from './sound';
import { loadPrefs } from './prefs';

/** Android vibrate patterns in ms (buzz, pause, buzz...). iPhone plays one tick per buzz. */
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

const IOS_GAP = 110; // ms between iPhone ticks, closer and they merge into one

const coarse = (): boolean => {
  try {
    return matchMedia('(pointer: coarse)').matches;
  } catch {
    return false;
  }
};
const canVibrate = (): boolean => typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

/** A phone that can buzz: Android with vibrate, or a touch screen without it (iPhone). Computers never show the setting. */
export const hapticsSupported = (): boolean => typeof window !== 'undefined' && coarse();

let on: boolean | undefined;
/** Use this setting from now on (sound-prefs calls it after saving). */
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
    // the clicks are ours: menus that close on an outside click, and the tap sound, must never see them
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
  if (now - (last.get(name) ?? -1e9) < 60) return; // a drag and the API move both report the same move
  last.set(name, now);
  const pattern = PATTERN[name];
  if (canVibrate()) {
    // Chrome refuses before the first tap on the page, and says so in the console; don't ask before then
    const ua = (navigator as any).userActivation;
    if (ua && !ua.hasBeenActive) return;
    try {
      navigator.vibrate(pattern);
    } catch {
      /* not allowed here */
    }
    return;
  }
  const ticks = Math.ceil(pattern.length / 2);
  for (let i = 0; i < ticks; i++) {
    if (i === 0) iosTick();
    else setTimeout(iosTick, i * IOS_GAP);
  }
}
