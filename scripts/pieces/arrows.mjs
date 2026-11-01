import { writeFileSync } from 'node:fs';

const BROWN = '#6B4E2E', RED = '#B8361F', BLACK = '#1C1B19';
const TRI = 'M0-4.2 5 3.6-5 3.6Z';
const KNIGHT = 'M0-6 3.6 4.2-3.6 4.2Z';
const A = { n: [44, 13, 0], ne: [67, 24, 45], nw: [21, 24, -45], e: [73, 58, 90], w: [15, 58, -90], s: [44, 90, 180], se: [76, 88, 135], sw: [12, 88, -135] };
const STEP8 = { n: 1, ne: 1, e: 1, se: 1, s: 1, sw: 1, w: 1, nw: 1 };
const GOLD = { n: 1, ne: 1, nw: 1, e: 1, w: 1, s: 1 };

const PIECES = [
  ['king', 'K', STEP8],
  ['rook', 'R', { n: 2, e: 2, s: 2, w: 2 }],
  ['bishop', 'B', { ne: 2, se: 2, sw: 2, nw: 2 }],
  ['gold', 'G', GOLD],
  ['silver', 'S', { n: 1, ne: 1, nw: 1, se: 1, sw: 1 }],
  ['knight', 'N', { jump: 1 }],
  ['lance', 'L', { n: 2 }],
  ['pawn', 'P', { n: 1 }],
  ['dragon', '+R', { n: 2, e: 2, s: 2, w: 2, ne: 'x', se: 'x', sw: 'x', nw: 'x' }, true],
  ['horse', '+B', { ne: 2, se: 2, sw: 2, nw: 2, n: 'x', e: 'x', s: 'x', w: 'x' }, true],
  ['promotedsilver', '+S', GOLD, true],
  ['promotedknight', '+N', GOLD, true],
  ['promotedlance', '+L', GOLD, true],
  ['tokin', '+P', GOLD, true],
];

const tri = (fill, t, d = TRI) => `<path fill='${fill}' d='${d}' transform='${t}'/>`;
function svg(moves, red) {
  const base = red ? RED : BROWN;
  let s = '';
  for (const [d, k] of Object.entries(moves)) {
    if (d === 'jump') {
      s += tri(base, 'translate(58 18) rotate(27)', KNIGHT) + tri(base, 'translate(30 18) rotate(-27)', KNIGHT);
      continue;
    }
    const [x, y, r] = A[d];
    const fill = k === 'x' ? BLACK : base;
    s += tri(fill, `translate(${x} ${y}) rotate(${r})`);
    if (k === 2) s += tri(fill, `translate(${x} ${y}) rotate(${r}) translate(0 6.5)`).replace('<path', "<path opacity='.75'");
  }
  const doc = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 88 100' preserveAspectRatio='none'>${s}</svg>`;
  return `url("data:image/svg+xml,${doc.replace(/#/g, '%23').replace(/</g, '%3C').replace(/>/g, '%3E')}")`;
}

let css = '';
for (const [role, t, moves, red] of PIECES) {
  css += `piece.${role}, .pc[data-t="${t}"] { --arrows: ${svg(moves, red)}; }\n`;
}
writeFileSync(new URL('../../src/styles/piece-arrows.css', import.meta.url), css);
console.log('wrote src/styles/piece-arrows.css');
