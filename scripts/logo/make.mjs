// Draws the logo and the site icons into public/. Run `npm run logo` after changing the drawing, then commit
// the images. Needs Playwright's Chromium, like scripts/og/make.mjs.
//   logo-132.png, logo-512.png   the logo: a red shogi piece with a white inner line, 将 and ישראל (transparent)
//   apple-touch-icon.png          the logo on paper, for the phone home screen
//   favicon-32.png, favicon-192.png  the browser tab: a red disc with a white ring and 将
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = new URL('../../', import.meta.url).pathname;
const out = join(root, 'public');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const sharp = require('sharp');
const css = (p) => pathToFileURL(join(root, 'node_modules', p)).href;

const C = { washi: '#ECE4D4', seal: '#B8361F', white: '#FFFFFF' };

// The piece: the same five-sided shape as the site's own icons (src/lib/icons.ts), drawn on a 100×100 grid.
const PIECE = [[50, 3], [79.7, 21.8], [88.1, 97], [11.9, 97], [20.3, 21.8]];

/** The polygon moved `d` inward on every side. */
function inset(pts, d) {
  const n = pts.length;
  const lines = pts.map((p, i) => {
    const q = pts[(i + 1) % n];
    const dx = q[0] - p[0], dy = q[1] - p[1], len = Math.hypot(dx, dy);
    const nx = -dy / len, ny = dx / len; // the inside is on this side for a clockwise polygon on a y-down grid
    return [[p[0] + nx * d, p[1] + ny * d], [q[0] + nx * d, q[1] + ny * d]];
  });
  return lines.map((l, i) => {
    const [a, b] = lines[(i + n - 1) % n], [c, e] = l;
    const d1 = [b[0] - a[0], b[1] - a[1]], d2 = [e[0] - c[0], e[1] - c[1]];
    const t = ((c[0] - a[0]) * d2[1] - (c[1] - a[1]) * d2[0]) / (d1[0] * d2[1] - d1[1] * d2[0]);
    return [a[0] + d1[0] * t, a[1] + d1[1] * t];
  });
}
const path = (pts) => 'M' + pts.map((p) => p.map((v) => v.toFixed(2)).join(' ')).join('L') + 'Z';

function logo(bg) {
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    ${bg ? `<rect width="100" height="100" fill="${bg}"/>` : ''}
    <g ${bg ? 'transform="translate(50 50) scale(.8) translate(-50 -50)"' : ''}>
      <path d="${path(PIECE)}" fill="${C.seal}" stroke="${C.seal}" stroke-width="3" stroke-linejoin="round"/>
      <path d="${path(inset(PIECE, 6))}" fill="none" stroke="${C.white}" stroke-width="1.8" stroke-linejoin="round"/>
      <text x="50" y="55" text-anchor="middle" font-family="Shippori Mincho" font-weight="800" font-size="44" fill="${C.white}">将</text>
      <text x="50" y="82" text-anchor="middle" direction="rtl" font-family="Heebo Variable" font-weight="800" font-size="12.5" fill="${C.white}">ישראל</text>
    </g>
  </svg>`;
}

function tab() {
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="50" fill="${C.seal}"/>
    <circle cx="50" cy="50" r="41" fill="none" stroke="${C.washi}" stroke-width="4"/>
    <text x="50" y="52" text-anchor="middle" dominant-baseline="central" font-family="Shippori Mincho" font-weight="800" font-size="56" fill="${C.white}">将</text>
  </svg>`;
}

const files = [
  ['logo-132.png', 132, logo()],
  ['logo-512.png', 512, logo()],
  ['apple-touch-icon.png', 180, logo(C.washi)],
  ['favicon-32.png', 32, tab()],
  ['favicon-192.png', 192, tab()],
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 600, height: 600 } });
// a file page, so it may load the font files from node_modules
const dir = mkdtempSync(join(tmpdir(), 'logo-'));
for (const [name, size, svg] of files) {
  writeFileSync(join(dir, 'p.html'), `<!doctype html><html><head>
    <link rel="stylesheet" href="${css('@fontsource/shippori-mincho/800.css')}">
    <link rel="stylesheet" href="${css('@fontsource-variable/heebo/index.css')}">
    <style>body{margin:0;background:transparent} svg{display:block;width:${size}px;height:${size}px}</style>
    </head><body><span style="font:800 1px 'Shippori Mincho'">将</span><span style="font:800 1px 'Heebo Variable'">ישראל</span>${svg}</body></html>`);
  await page.goto(pathToFileURL(join(dir, 'p.html')).href);
  await page.evaluate(() => document.fonts.ready);
  const shot = await page.locator('svg').screenshot({ omitBackground: true });
  await sharp(shot).png({ compressionLevel: 9 }).toFile(join(out, name));
}
await browser.close();
rmSync(dir, { recursive: true, force: true });
console.log(`${files.length} images in public/`);
