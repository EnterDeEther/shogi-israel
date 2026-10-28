// Shogi Israel: the site's sounds, played with Web Audio. Lishogi's sound sets are not free to reuse, so these are our own.
// Board: Dean's own recording of a shogi piece on a board (public/sounds/piece.wav, recorded by Dean at home, 2026-10-27),
// played a touch higher or lower each time; a capture adds a quiet copy for the piece going into the hand.
// Everything else is synthesized here: koto strings (plucked-string model) for lessons and puzzles, hyoshigi (kabuki wooden
// clappers) for the start of a game and check, a rin bell for points and ranks. Scale: D "yo" pentatonic (D E G A B).
// Listening page with the same sounds: https://claude.ai/artifact/KJvUnVmMJqiSwFgoj28k2J
// Rules: nothing plays before the visitor has tapped or pressed a key, nothing plays in a background tab, and the one
// switch (prefs.sound, the cog wheel and /account/) silences all of it; each kind of sound also has its own switch
// (prefs.sndBoard and the rest, see CATEGORY). Volume is prefs.vol (0 to 1, default 0.8).
// Phones: the first tap anywhere unlocks audio (iOS keeps a page's audio suspended until a tap resumes it), and an
// iPhone with its silent switch on stays silent on websites, as it should.
// AGPL-3.0-or-later, like the rest of src/learn/.
import { type LearnPrefs, loadPrefs } from './prefs';

export type SoundName =
  | 'move' | 'capture' | 'drop' | 'promote' | 'check' // the board
  | 'gameStart' | 'win' | 'lose' // a game on /play/
  | 'start' | 'success' | 'fail' | 'end' | 'solved' // lessons and puzzles: stage starts, exercise solved, wrong move, stage finished, puzzle solved
  | 'points' | 'rank' // the points toast
  | 'tap' | 'toggle'; // buttons, menus and switches

export type SoundPref = 'sndBoard' | 'sndGame' | 'sndLessons' | 'sndProgress' | 'sndUi';
const CATEGORY: Record<SoundName, SoundPref> = {
  move: 'sndBoard', capture: 'sndBoard', drop: 'sndBoard', promote: 'sndBoard', check: 'sndBoard',
  gameStart: 'sndGame', win: 'sndGame', lose: 'sndGame',
  start: 'sndLessons', success: 'sndLessons', fail: 'sndLessons', end: 'sndLessons', solved: 'sndLessons',
  points: 'sndProgress', rank: 'sndProgress',
  tap: 'sndUi', toggle: 'sndUi',
};

let ctx: AudioContext | undefined;
let out: GainNode | undefined;
let cur: LearnPrefs | undefined;
let sr = 44100;
let lastOther = 0; // when a sound other than a tap last played (a tap gives way to the move its button plays)
let piece: AudioBuffer | null = null;
let pieceLoading: Promise<void> | undefined;
const cache = new Map<string, AudioBuffer>();
const last = new Map<string, number>();

const prefs = (): LearnPrefs => (cur ??= loadPrefs());

/** Use these settings from now on (the cog wheel and /account/ call it after saving). */
export function applySoundPrefs(p: LearnPrefs): void {
  cur = { ...p };
  if (ctx && out) out.gain.setTargetAtTime(p.vol * p.vol, ctx.currentTime, 0.03);
}

/** Fetch and decode the piece recording (21 KB) ahead of the first move. Boards call it when they load. */
export function preloadSounds(): Promise<void> {
  if (!pieceLoading) {
    pieceLoading = (async () => {
      try {
        const res = await fetch('/sounds/piece.wav');
        if (!res.ok) return;
        const data = await res.arrayBuffer();
        const OAC = window.OfflineAudioContext || (window as any).webkitOfflineAudioContext;
        if (!OAC) return;
        piece = await new Promise<AudioBuffer>((ok, no) => new OAC(1, 1, 44100).decodeAudioData(data, ok, no));
      } catch {
        /* no sound for the board; everything else still works */
      }
    })();
  }
  return pieceLoading;
}

function audio(): AudioContext | undefined {
  // Browsers refuse audio before the first tap or key press; don't even try (no console noise).
  const ua = (navigator as any).userActivation;
  if (!ctx && ua && !ua.hasBeenActive) return undefined;
  if (!ctx) {
    try {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!AC) return undefined;
      ctx = new AC() as AudioContext;
      sr = ctx.sampleRate;
      out = ctx.createGain();
      out.gain.value = prefs().vol ** 2;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -12;
      comp.ratio.value = 4;
      comp.attack.value = 0.002;
      comp.release.value = 0.12;
      out.connect(comp).connect(ctx.destination);
    } catch {
      return undefined;
    }
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

// ---------------------------------------------------------------- synthesis

const TAU = Math.PI * 2;
const NOTE = { D4: 293.66, E4: 329.63, G4: 392, A4: 440, B4: 493.88, D5: 587.33, E5: 659.25, A5: 880, B5: 987.77, D6: 1174.66 };

let seed = 1;
const rnd = (): number => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

type Modes = [freq: number, decay: number, amp: number][];
const HYOSHIGI: Modes = [[1180, 0.06, 1], [1260, 0.05, 0.5], [2780, 0.03, 0.55], [4300, 0.018, 0.3], [650, 0.04, 0.35]];
const TAP: Modes = [[1700, 0.004, 1], [2900, 0.003, 0.6], [4200, 0.002, 0.3]]; // a tiny dry tick, for buttons

/** Hyoshigi: a very short contact noise ringing a bank of damped resonators (hard wood on hard wood). */
function clap(d: Float32Array, at: number, amp = 1, modes: Modes = HYOSHIGI): void {
  const s0 = Math.floor(at * sr), L = Math.min(d.length - s0, Math.ceil(0.3 * sr)), exT = 0.0006;
  const exN = Math.ceil(exT * 8 * sr), ex = new Float32Array(L);
  for (let i = 0; i < exN && i < L; i++) ex[i] = (rnd() * 2 - 1) * Math.exp(-i / sr / exT);
  const b0 = Math.floor(0.0015 * sr);
  for (let i = 0; i < exN && b0 + i < L; i++) ex[b0 + i] += 0.25 * (rnd() * 2 - 1) * Math.exp(-i / sr / exT);
  for (const [f, dec, a] of modes) {
    const w = (TAU * f * (0.97 + rnd() * 0.06)) / sr, r = Math.exp(-1 / (dec * sr));
    const c1 = 2 * r * Math.cos(w), c2 = -r * r, g = a * (1 - r) * 2 * Math.sin(w);
    let y1 = 0, y2 = 0;
    for (let i = 0; i < L; i++) {
      const v = g * ex[i] + c1 * y1 + c2 * y2;
      y2 = y1;
      y1 = v;
      d[s0 + i] += amp * v;
    }
  }
  let prev = 0;
  for (let i = 0; i < exN && i < L; i++) {
    d[s0 + i] += amp * 0.008 * (ex[i] - prev);
    prev = ex[i];
  }
}

/** Koto string: plucked-string (Karplus-Strong) model with a plectrum click. */
function koto(d: Float32Array, at: number, f: number, { amp = 1, bright = 0.55, t60 = 1.6, pos = 0.13 } = {}): void {
  const s0 = Math.floor(at * sr), L = Math.min(d.length - s0, Math.ceil((t60 + 0.1) * sr));
  const D = sr / f - 0.5, N = Math.ceil(D) + 2, y = new Float32Array(L);
  const rho = Math.pow(10, -3 / (f * t60));
  const ex = new Float32Array(N);
  let lp = 0;
  for (let i = 0; i < N; i++) {
    lp += (rnd() * 2 - 1 - lp) * bright;
    ex[i] = lp;
  }
  const pp = Math.max(1, Math.round(pos * N));
  for (let i = N - 1; i >= pp; i--) ex[i] -= ex[i - pp];
  const rd = (n: number): number => {
    if (n < 0) return 0;
    const i = Math.floor(n), fr = n - i;
    return y[i] * (1 - fr) + (i + 1 < L ? y[i + 1] : 0) * fr;
  };
  for (let n = 0; n < L; n++) y[n] = (n < N ? ex[n] : 0) + rho * 0.5 * (rd(n - D) + rd(n - D - 1));
  let prev = 0;
  const pickN = 0.004 * sr, fadeN = 0.05 * sr;
  for (let n = 0; n < L; n++) {
    let pick = 0;
    if (n < pickN) {
      const x = rnd() * 2 - 1;
      pick = (x - prev) * 0.12 * (1 - n / pickN);
      prev = x;
    }
    d[s0 + n] += amp * (y[n] * (n > L - fadeN ? (L - n) / fadeN : 1) + pick);
  }
}

/** Rin bell: inharmonic partials, each a slowly beating pair. */
function rin(d: Float32Array, at: number, f: number, { amp = 1, decay = 2.2 } = {}): void {
  const s0 = Math.floor(at * sr);
  for (const [r, a, dm] of [[1, 1, 1], [2.71, 0.45, 0.5], [5.17, 0.22, 0.28], [8.43, 0.1, 0.16]])
    for (const det of [0, 1.4]) {
      const ff = f * r + det, dec = decay * dm, ph = rnd() * TAU, n = Math.min(d.length - s0, Math.ceil(dec * 7 * sr));
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        d[s0 + i] += amp * a * 0.5 * Math.exp(-t / dec) * (1 - Math.exp(-t / 0.002)) * Math.sin(TAU * ff * t + ph);
      }
    }
}

type Layer = [at: number, id: 'piece' | Synth, rate: number, gain: number];
type Synth = 'clap' | 'promoteNote' | SoundName;
interface Def {
  len: number; // seconds
  db: number; // level, relative
  layers?: Layer[];
  rate?: [from: number, to: number, seconds: number]; // pitch bend
  r?: (d: Float32Array) => void;
}

const DEF: Record<Synth, Def> = {
  // Dean, 2026-10-28: the board was too quiet; it is now the loudest everyday sound
  move: { len: 0.25, db: 0, layers: [[0, 'piece', 1, 1]] },
  capture: { len: 0.35, db: 1, layers: [[0, 'piece', 0.96, 1.05], [0.085, 'piece', 1.35, 0.3]] },
  drop: { len: 0.3, db: 1, layers: [[0, 'piece', 0.9, 1.15]] },
  promote: { len: 0.8, db: 0, layers: [[0, 'piece', 1, 1], [0.05, 'piece', 1.5, 0.22], [0.07, 'promoteNote', 1, 0.5]] },
  // played by the board right after a move that gives check (the piece itself already sounded)
  check: { len: 0.4, db: -4, layers: [[0.1, 'clap', 1, 1]] },
  tap: { len: 0.1, db: -15, r: (d) => clap(d, 0, 1, TAP) },
  toggle: { len: 0.15, db: -14, r: (d) => { clap(d, 0, 1, TAP); clap(d, 0.035, 0.7, TAP); } },
  clap: { len: 0.4, db: 0, r: (d) => clap(d, 0) },
  promoteNote: { len: 0.8, db: 0, r: (d) => koto(d, 0, NOTE.A5, { amp: 0.35, t60: 0.7, bright: 0.7 }) },
  gameStart: { len: 1, db: -5, r: (d) => { clap(d, 0); clap(d, 0.42); } },
  win: {
    len: 3.8, db: -5,
    r: (d) => {
      [0, 0.34, 0.58, 0.74, 0.85, 0.93, 0.99, 1.04, 1.08].forEach((t, i) => clap(d, t, 1 - i * 0.06));
      rin(d, 1.2, NOTE.D5, { amp: 0.9, decay: 2 });
      koto(d, 1.2, NOTE.D4, { amp: 0.5, t60: 1.8 });
    },
  },
  lose: {
    len: 2.4, db: -6,
    r: (d) => {
      koto(d, 0, NOTE.A4, { amp: 0.7, t60: 1.2, bright: 0.4 });
      koto(d, 0.26, NOTE.G4, { amp: 0.6, t60: 1.2, bright: 0.35 });
      koto(d, 0.56, NOTE.D4, { amp: 0.7, t60: 1.8, bright: 0.3 });
    },
  },
  start: { len: 1.4, db: -7, r: (d) => { koto(d, 0, NOTE.D4, { amp: 0.8, t60: 1.2 }); koto(d, 0.13, NOTE.A4, { amp: 0.6, t60: 1.2 }); } },
  success: {
    len: 1, db: -5,
    r: (d) => { koto(d, 0, NOTE.D5, { amp: 0.7, t60: 0.8, bright: 0.65 }); koto(d, 0.09, NOTE.A5, { amp: 0.7, t60: 0.9, bright: 0.65 }); },
  },
  fail: { len: 0.9, db: -9, rate: [1, 0.94, 0.3], r: (d) => koto(d, 0, 220, { amp: 0.9, t60: 0.7, bright: 0.3 }) },
  end: {
    len: 2.8, db: -5,
    r: (d) => {
      [NOTE.D4, NOTE.E4, NOTE.A4, NOTE.B4, NOTE.D5].forEach((f, i) => koto(d, i * 0.1, f, { amp: 0.55, t60: 1.6 - i * 0.1 }));
      rin(d, 0.5, NOTE.D6, { amp: 0.25, decay: 1.2 });
    },
  },
  solved: {
    len: 1.6, db: -4,
    r: (d) => { koto(d, 0, NOTE.D5, { amp: 0.6, t60: 1 }); koto(d, 0.1, NOTE.A5, { amp: 0.55, t60: 1 }); koto(d, 0.2, NOTE.D6, { amp: 0.5, t60: 1.2 }); },
  },
  points: { len: 1.2, db: -15, r: (d) => rin(d, 0, NOTE.A5 * 1.5, { amp: 0.5, decay: 0.45 }) },
  rank: {
    len: 4.2, db: -6,
    r: (d) => {
      rin(d, 0, NOTE.D4 * 1.5, { amp: 1, decay: 2.4 });
      [NOTE.D5, NOTE.E5, NOTE.A5, NOTE.B5, NOTE.D6].forEach((f, i) => koto(d, 0.25 + i * 0.09, f, { amp: 0.35, t60: 1.2 }));
    },
  },
};

/** Render a synthesized sound once (normalized, tail faded so it never ends in a click). */
function buffer(a: AudioContext, id: Synth): AudioBuffer | null {
  const def = DEF[id];
  if (!def.r) return null;
  let b = cache.get(id);
  if (!b) {
    seed = 1000 + id.length * 13;
    const d = new Float32Array(Math.ceil(def.len * sr));
    def.r(d);
    let peak = 0;
    for (const x of d) peak = Math.max(peak, Math.abs(x));
    const g = peak ? 0.9 / peak : 1, F = Math.floor(d.length * 0.85);
    for (let i = 0; i < d.length; i++) d[i] *= g * (i > F ? (d.length - i) / (d.length - F) : 1);
    b = a.createBuffer(1, d.length, sr);
    b.getChannelData(0).set(d);
    cache.set(id, b);
  }
  return b;
}

export function play(name: SoundName): void {
  const p = prefs();
  if (!p.sound || !p[CATEGORY[name]] || document.hidden || !p.vol) return;
  if (CATEGORY[name] !== 'sndUi') lastOther = performance.now();
  const a = audio();
  if (!a || !out) return;
  const now = a.currentTime;
  if (now - (last.get(name) ?? -1) < 0.06) return; // the same sound twice in a row (a drag and an API move) plays once
  last.set(name, now);
  const def = DEF[name];
  const bus = a.createGain();
  bus.gain.value = Math.pow(10, def.db / 20);
  bus.connect(out);
  const layers: Layer[] = def.layers ?? [[0, name, 1, 1]];
  if (layers.some(([, id]) => id === 'piece') && !piece) void preloadSounds();
  for (const [at, id, rate, gain] of layers) {
    const buf = id === 'piece' ? piece : buffer(a, id);
    if (!buf) continue;
    const src = a.createBufferSource();
    src.buffer = buf;
    const jitter = id === 'piece';
    src.playbackRate.value = rate * (jitter ? 0.97 + Math.random() * 0.06 : 1); // never quite the same knock twice
    const g = a.createGain();
    g.gain.value = gain * (jitter ? 0.9 + Math.random() * 0.1 : 1);
    const t = now + 0.005 + at;
    const bend = id === name ? def.rate : undefined;
    if (bend) {
      src.playbackRate.setValueAtTime(bend[0], t + 0.02);
      src.playbackRate.linearRampToValueAtTime(bend[1], t + 0.02 + bend[2]);
    }
    src.connect(g).connect(bus);
    src.start(t);
  }
}

/** The board sound for a move: capture first, then promotion, else a plain move. */
export function playMove(captured: boolean, promotion: boolean): void {
  play(captured ? 'capture' : promotion ? 'promote' : 'move');
}

/** A board step in a game viewer (/try/, /kif/): the move's sound, then the clap if it gives check. */
export function playStep(drop: boolean, captured: boolean, promotion: boolean, check: boolean): void {
  if (drop) play('drop');
  else playMove(captured, promotion);
  if (check) play('check');
}

// ---------------------------------------------------------------- every page

function unlock(): void {
  const a = audio();
  if (!a) return;
  // a silent sample started inside the tap is what lets iOS play the later ones
  const src = a.createBufferSource();
  src.buffer = a.createBuffer(1, 1, a.sampleRate);
  src.connect(a.destination);
  src.start();
  if (a.state === 'running') for (const ev of UNLOCK) document.removeEventListener(ev, unlock, true);
}
const UNLOCK = ['pointerup', 'touchend', 'keydown', 'click'] as const;

/** Buttons, menus and switches: a tiny tick (sndUi). Links in running text and the boards themselves stay quiet. */
const TAPPABLE = 'button, summary, [role="button"], .btn, header a, nav a, input[type="checkbox"], input[type="radio"]';
function onClick(e: MouseEvent): void {
  const t = (e.target as Element | null)?.closest?.(TAPPABLE);
  if (!t || (t as HTMLButtonElement).disabled) return;
  const name: SoundName = t.matches('input') ? 'toggle' : 'tap';
  const at = performance.now();
  setTimeout(() => { if (lastOther < at) play(name); }, 0); // after the button's own handler: a move or a solved sound wins
}

if (typeof document !== 'undefined') {
  for (const ev of UNLOCK) document.addEventListener(ev, unlock, { capture: true, passive: true });
  document.addEventListener('click', onClick, true);
  // the setting changed on another page or tab
  window.addEventListener('storage', (e) => { if (e.key?.endsWith('learn.prefs')) applySoundPrefs(loadPrefs()); });
}
