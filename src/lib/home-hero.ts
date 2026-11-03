import type { PieceType } from './sfen';

export interface HeroScene {
  sfen: string;
  moves: { usi: string; check?: boolean }[];
  view: { files: number; ranks: number };
  still: number;
}

export const HERO_SCENE: HeroScene = {
  sfen: 'ln1g3nl/1ksg5/ppppp2pp/9/5p3/6p2/PPPPP3P/3SG2K1/LN4GNL w Pbsp 1',
  moves: [{ usi: 'S*3g', check: true }, { usi: '2h1h' }, { usi: '3g2h+', check: true }, { usi: '1h2h' }, { usi: 'B*4f', check: true }, { usi: 'S*3g' }],
  view: { files: 5.55, ranks: 4.4 },
  still: 3,
};

type G = 0 | 1;
interface Pc { id: string; t: PieceType; g: G; pr: boolean; at: string }
interface St { x: number; y: number; s: number; lift: number; o: number; rot: number; g: G; pr: number; flip: number }
interface Way extends St { t: number; ease: string }

const LOOP = 10.5, START = 0.7, PLY = 1.25, TAKE = 1.6, HOLD = 9.5, OUT = 10;
const EASE = 'var(--ease-out)', SOFT = 'ease-in-out', LIN = 'linear';
const STAND = 1.12, GAP = 0.22, PITCH = 0.86;
const ORDER: PieceType[] = ['R', 'B', 'G', 'S', 'N', 'L', 'P'];

const sq = (s: string) => ({ file: +s[0], rank: s.charCodeAt(1) - 96 });

export function heroLayout(sc: HeroScene) {
  const [boardPart, turn, handPart] = sc.sfen.split(' ');
  const bw = sc.view.files, bh = sc.view.ranks;
  const bx = STAND + GAP;
  const w = bx + bw + GAP + STAND;
  const inView = (s: string) => { const { file, rank } = sq(s); return file <= Math.floor(bw) && rank >= 10 - Math.floor(bh); };
  const boardXY = (s: string) => { const { file, rank } = sq(s); return { x: bx + bw - file, y: bh - (10 - rank) }; };
  const board = new Map<string, Pc>();
  const hands: Record<G, Pc[]> = { 0: [], 1: [] };
  let n = 0;
  boardPart.split('/').forEach((row, ri) => {
    let file = 9, pr = false;
    for (const ch of row) {
      if (/\d/.test(ch)) { file -= +ch; continue; }
      if (ch === '+') { pr = true; continue; }
      const key = `${file}${String.fromCharCode(97 + ri)}`;
      board.set(key, { id: `p${n++}`, t: ch.toUpperCase() as PieceType, g: ch === ch.toUpperCase() ? 0 : 1, pr, at: key });
      file--; pr = false;
    }
  });
  let count = 1;
  for (const ch of handPart === '-' ? '' : handPart) {
    if (/\d/.test(ch)) { count = +ch; continue; }
    const g: G = ch === ch.toUpperCase() ? 0 : 1;
    for (let k = 0; k < count; k++) hands[g].push({ id: `p${n++}`, t: ch.toUpperCase() as PieceType, g, pr: false, at: '' });
    count = 1;
  }
  const slots: Record<G, string[]> = { 0: [], 1: [] };
  const slotOf = (p: Pc) => {
    let k = slots[p.g].indexOf(p.id);
    if (k < 0) { k = slots[p.g].length; slots[p.g].push(p.id); }
    return p.g ? { x: STAND / 2 - 0.5, y: 0.15 + PITCH / 2 - 0.5 + k * PITCH } : { x: bx + bw + GAP + STAND / 2 - 0.5, y: bh - 0.15 - PITCH / 2 - 0.5 - k * PITCH };
  };
  for (const g of [0, 1] as G[]) hands[g].sort((a, b) => ORDER.indexOf(a.t) - ORDER.indexOf(b.t)).forEach(slotOf);

  const way = new Map<string, Way[]>();
  const meta = new Map<string, Pc>();
  const rest = (p: Pc, held: boolean): St => {
    const xy = held ? slotOf(p) : boardXY(p.at);
    return { ...xy, s: held ? 0.82 : 1, lift: 0, o: 1, rot: p.g ? 180 : 0, g: p.g, pr: p.pr ? 1 : 0, flip: 1 };
  };
  const push = (p: Pc, t: number, ch: Partial<St>, ease = LIN) => {
    const list = way.get(p.id)!;
    const last = list[list.length - 1];
    list.push({ ...last, ...ch, t, ease });
  };
  const track = (p: Pc, held: boolean) => { if (!way.has(p.id)) { way.set(p.id, [{ ...rest(p, held), t: 0, ease: LIN }]); meta.set(p.id, { ...p }); } };
  for (const p of [...board.values()].filter((p) => inView(p.at))) track(p, false);
  for (const p of [...hands[0], ...hands[1]]) track(p, true);

  const flashes: { x: number; y: number; t: number }[] = [];
  const snaps: Set<string>[] = [];
  const snap = () => snaps.push(new Set(board.keys()));
  snap();
  let side: G = turn === 'b' ? 0 : 1;
  let t = START;
  const kingAt = (g: G) => [...board.values()].find((p) => p.t === 'K' && p.g === g)!.at;
  for (const { usi, check } of sc.moves) {
    const t0 = t;
    const drop = usi[1] === '*';
    const to = usi.slice(2, 4);
    const promote = usi.endsWith('+');
    const mover = drop ? hands[side].find((p) => p.t === usi[0])! : board.get(usi.slice(0, 2))!;
    const taken = drop ? undefined : board.get(to);
    if (drop) hands[side] = hands[side].filter((p) => p !== mover); else board.delete(mover.at);
    const dest = boardXY(to);
    push(mover, t, {}, SOFT);
    push(mover, t + 0.2, { s: 1.08, lift: 1 }, EASE);
    push(mover, t + 0.85, { ...dest, s: 1.08, lift: 1 }, SOFT);
    if (promote) {
      push(mover, t + 0.95, { flip: 0.04 });
      push(mover, t + 0.951, { pr: 1 }, SOFT);
      push(mover, t + 1.05, { flip: 1, s: 1, lift: 0 });
    } else push(mover, t + 1.05, { s: 1, lift: 0 });
    mover.at = to;
    if (promote) mover.pr = true;
    board.set(to, mover);
    if (taken) {
      push(taken, t + 0.6, {}, EASE);
      push(taken, t + 0.85, { x: dest.x + 0.45, y: dest.y - 0.06, s: 0.94, lift: 1 }, SOFT);
      push(taken, t + 1.0, { flip: 0.04 });
      push(taken, t + 1.001, { pr: 0, g: side, rot: side ? 180 : 0 }, SOFT);
      taken.g = side; taken.pr = false; taken.at = '';
      hands[side].push(taken);
      push(taken, t + 1.15, { flip: 1 }, EASE);
      push(taken, t + (TAKE - 0.05), { ...slotOf(taken), s: 0.82, lift: 0 });
    }
    t += taken ? TAKE : PLY;
    side = side ? 0 : 1;
    snap();
    if (check) flashes.push({ ...boardXY(kingAt(side)), t: t0 + 1.0 });
  }
  const changed = [...way.keys()].filter((id) => { const l = way.get(id)!; const a = l[0], b = l[l.length - 1]; return a.x !== b.x || a.y !== b.y || a.g !== b.g || a.pr !== b.pr || a.s !== b.s; });
  for (const id of changed) {
    const p = { id } as Pc;
    push(p, HOLD, {});
    push(p, OUT - 0.02, { o: 0 });
    push(p, OUT, { ...way.get(id)![0], o: 0 }, SOFT);
    push(p, LOOP, { o: 1 });
  }

  const still = sampleAt(way, snapTime(sc.still));
  function snapTime(k: number) { let tt = START; sc.moves.slice(0, k).forEach(({ usi }, i) => { tt += usi[1] !== '*' && snaps[i].has(usi.slice(2, 4)) ? TAKE : PLY; }); return tt; }
  const stillFlash = flashes.filter((f) => f.t < snapTime(sc.still) && f.t > snapTime(sc.still - 1));

  const pct = (v: number) => `${+(v / LOOP * 100).toFixed(3)}%`;
  const tr = (s: St) => `translate: calc(${n3(s.x)} * var(--q)) calc(${n3(s.y)} * var(--q)); scale: ${s.s}; opacity: ${s.o}; filter: ${s.lift ? 'drop-shadow(0 5px 5px rgba(0, 0, 0, .26))' : 'drop-shadow(0 0 0 rgba(0, 0, 0, 0))'}`;
  const frames = (name: string, list: Way[], body: (s: Way) => string) =>
    `@keyframes ${name}{${list.map((s) => `${pct(s.t)}{${body(s)};animation-timing-function:${s.ease}}`).join('')}${list[list.length - 1].t < LOOP ? `100%{${body(list[list.length - 1])}}` : ''}}`;
  const anim = (sel: string, name: string) => `[data-hero-art] ${sel}{animation:${name} var(--loop) linear infinite var(--play) both}`;
  const css: string[] = [];
  const pieces = [...way.keys()].map((id) => {
    const list = way.get(id)!;
    const m = meta.get(id)!;
    const moves = list.length > 1;
    if (moves) {
      css.push(frames(`hh-${id}`, list, tr), anim(`[data-hid="${id}"]`, `hh-${id}`));
      css.push(frames(`hh-${id}-sh`, list, (s) => `rotate: ${s.rot}deg; scale: ${s.flip} 1`), anim(`[data-hid="${id}"] .sh`, `hh-${id}-sh`));
      if (list.some((s) => s.g !== list[0].g)) css.push(frames(`hh-${id}-w`, list, (s) => `background-color: var(${s.g ? '--piece-gote' : '--piece'})`), anim(`[data-hid="${id}"] .sh::after`, `hh-${id}-w`));
      if (list.some((s) => s.pr !== list[0].pr)) {
        css.push(frames(`hh-${id}-n`, list, (s) => `opacity: ${1 - s.pr}`), anim(`[data-hid="${id}"] .hn`, `hh-${id}-n`));
        css.push(frames(`hh-${id}-u`, list, (s) => `opacity: ${s.pr}`), anim(`[data-hid="${id}"] .hu`, `hh-${id}-u`));
      }
    }
    const s = still.get(id)!;
    return { id, t: m.t, promotes: list.some((x) => x.pr), still: s };
  });
  flashes.forEach((f, i) => {
    const list: Way[] = [0, f.t, f.t + 0.18, f.t + 0.5, f.t + 1.2].map((tt, k) => ({ t: tt, ease: k === 2 ? SOFT : EASE, x: 0, y: 0, s: 1, lift: 0, o: k === 2 || k === 3 ? 1 : 0, rot: 0, g: 0, pr: 0, flip: 1 }));
    css.push(frames(`hh-f${i}`, list, (s) => `opacity: ${s.o}`), anim(`[data-flash="${i}"]`, `hh-f${i}`));
  });
  return {
    w, h: bh, board: { x: bx, w: bw, h: bh, lx: bw % 1, ly: bh % 1 },
    stands: ([1, 0] as G[]).filter((g) => slots[g].length).map((g) => {
      const h = slots[g].length * PITCH + 0.3;
      return g ? { x: 0, y: 0, w: STAND, h } : { x: bx + bw + GAP, y: bh - h, w: STAND, h };
    }),
    hoshi: [{ x: bx + bw - 3, y: bh - 3 }, { x: bx + bw - 6, y: bh - 3 }].filter((p) => p.x > bx && p.y > 0),
    pieces, flashes: flashes.map((f, i) => ({ ...f, i, on: stillFlash.includes(f) })),
    css: `@media (prefers-reduced-motion: no-preference){html:not(.tour-on) [data-hero-art]{--loop:${LOOP}s}${css.map((c) => c.startsWith('@') ? c : `html:not(.tour-on) ${c}`).join('')}}`,
  };
}

function n3(v: number) { return +v.toFixed(3); }

function sampleAt(way: Map<string, Way[]>, t: number) {
  const out = new Map<string, St>();
  for (const [id, list] of way) out.set(id, [...list].reverse().find((s) => s.t <= t + 0.0001) ?? list[0]);
  return out;
}

export const HERO_ART = heroLayout(HERO_SCENE);
