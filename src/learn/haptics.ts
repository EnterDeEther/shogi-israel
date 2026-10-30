// Shogi Israel: haptic feedback (a short buzz in the hand) for the same moments that make a sound (src/learn/sound.ts
// calls buzz() from play()). Works without sound: the phone can be on silent and still tick on each move.
// Android (Chrome, Firefox, Samsung Internet): navigator.vibrate with a short pattern per kind of moment.
// iPhone: Safari has no vibrate, but since iOS 17.4 a finger flipping a switch (<input type="checkbox" switch>) gives the
// system haptic tick. Up to iOS 26.4 a page could also click a hidden switch from code (iosTick below, kept for those
// phones); iOS 26.5 closed that, and only a real finger on a switch ticks now. So every plain button carries an invisible
// switch label over it (armButtons): the tap lands on it, iOS ticks, and the click goes on to the button as before.
// The board can't do this: it cancels its touches (to drag pieces), which also turns the switch off, so on a new iPhone
// moves and right/wrong answers don't buzz, only button taps do. iPads and computers have nothing to buzz, and the
// setting is hidden there.
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

const isIOS = (): boolean =>
  typeof navigator !== 'undefined' &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

let on: boolean | undefined;
/** Use this setting from now on (sound-prefs calls it after saving). */
export function applyHaptics(value: boolean): void {
  on = value;
  document.documentElement.toggleAttribute('data-haptics-off', !value);
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

// ---------------------------------------------------------------- iPhone: a switch under the finger on every button

const TAP_SEL = 'button[data-haptic-tap-host]';
let armed = false;

/** Plain buttons only: a label over a submit button, a popover button or a link would take over its default action. */
function wants(b: HTMLButtonElement): boolean {
  return (b.type === 'button' || !b.form) && !b.hasAttribute('popovertarget') && !b.hasAttribute('commandfor') &&
    !b.closest('[data-board], .sg-wrap, sg-wrap, [data-haptic]');
}

function arm(b: HTMLButtonElement): void {
  if (b.querySelector(':scope > [data-haptic-tap]') || !wants(b)) return;
  const l = document.createElement('label');
  l.setAttribute('data-haptic-tap', '');
  l.setAttribute('aria-hidden', 'true');
  const i = document.createElement('input');
  i.type = 'checkbox';
  i.setAttribute('switch', '');
  i.tabIndex = -1;
  i.addEventListener('click', (e) => e.stopPropagation()); // the label's own click goes on to the button; this one is ours
  l.append(i);
  b.setAttribute('data-haptic-tap-host', '');
  b.append(l);
}

/** Put the switch on every plain button now and on every button added later (lessons redraw theirs). */
function armButtons(): void {
  if (armed || !isIOS() || !hapticsSupported()) return;
  armed = true;
  const css = document.createElement('style');
  css.textContent =
    `${TAP_SEL}{position:relative}` +
    `${TAP_SEL}>[data-haptic-tap]{position:absolute;inset:0;margin:0;padding:0;border-radius:inherit;` +
    `touch-action:manipulation;-webkit-tap-highlight-color:transparent;cursor:inherit}` +
    `${TAP_SEL}>[data-haptic-tap]>input{position:absolute;width:1px;height:1px;margin:0;visibility:hidden}` +
    `html[data-haptics-off] [data-haptic-tap],${TAP_SEL}:disabled>[data-haptic-tap]{display:none}`;
  document.head.append(css);
  const scan = () => document.querySelectorAll<HTMLButtonElement>('button').forEach(arm);
  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; scan(); });
  }).observe(document.body, { childList: true, subtree: true });
  scan();
}

if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
  const start = () => {
    if (!loadPrefs().haptics) document.documentElement?.setAttribute('data-haptics-off', '');
    armButtons();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
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
  if (armed && (name === 'tap' || name === 'toggle')) return; // the button's own switch already ticked
  const ticks = Math.ceil(pattern.length / 2);
  for (let i = 0; i < ticks; i++) {
    if (i === 0) iosTick();
    else setTimeout(iosTick, i * IOS_GAP);
  }
}
