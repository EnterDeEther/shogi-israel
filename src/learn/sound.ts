// Shogi Israel: lesson sounds, synthesized with Web Audio. Lishogi's sound sets are not free to reuse,
// so these are our own: a wooden click for a move, a heavier one for a capture, a short koto-like
// pluck when a stage starts and a rising pair when a level is solved.
// AGPL-3.0-or-later, like the rest of src/learn/.

export type SoundName = 'move' | 'capture' | 'start' | 'success' | 'end' | 'fail';

let ctx: AudioContext | undefined;
let enabled = true;

export function setSoundEnabled(on: boolean): void {
  enabled = on;
}

function audio(): AudioContext | undefined {
  // Browsers refuse audio before the first tap or key press; don't even try (no console noise).
  if (!ctx && (navigator as any).userActivation && !(navigator as any).userActivation.hasBeenActive) return undefined;
  if (!ctx) {
    try {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (AC) ctx = new AC();
    } catch {
      return undefined;
    }
  }
  if (ctx?.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

/** Short filtered noise burst: a piece put down on a wooden board. */
function click(a: AudioContext, t: number, gain: number, freq: number): void {
  const len = Math.floor(a.sampleRate * 0.05);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 4;
  const src = a.createBufferSource();
  src.buffer = buf;
  const bp = a.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = freq;
  bp.Q.value = 1.4;
  const g = a.createGain();
  g.gain.value = gain;
  src.connect(bp).connect(g).connect(a.destination);
  src.start(t);
}

/** Plucked string: fast attack, exponential decay. */
function pluck(a: AudioContext, t: number, freq: number, gain = 0.12, dur = 0.7): void {
  const o = a.createOscillator();
  o.type = 'triangle';
  o.frequency.value = freq;
  const g = a.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.05);
}

export function play(name: SoundName): void {
  if (!enabled) return;
  const a = audio();
  if (!a) return;
  const t = a.currentTime + 0.01;
  switch (name) {
    case 'move':
      click(a, t, 0.9, 1800);
      break;
    case 'capture':
      click(a, t, 1.1, 1100);
      click(a, t + 0.035, 0.6, 2200);
      break;
    case 'start':
      pluck(a, t, 293.66);
      pluck(a, t + 0.12, 440, 0.1);
      break;
    case 'success':
      pluck(a, t, 587.33, 0.08, 0.35);
      pluck(a, t + 0.09, 880, 0.08, 0.45);
      break;
    case 'end':
      pluck(a, t, 293.66, 0.1, 0.9);
      pluck(a, t + 0.14, 349.23, 0.1, 0.9);
      pluck(a, t + 0.28, 440, 0.1, 1.2);
      break;
    case 'fail':
      pluck(a, t, 220, 0.08, 0.5);
      pluck(a, t + 0.12, 207.65, 0.08, 0.6);
      break;
  }
}
