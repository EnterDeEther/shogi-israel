// Draws the logo and the site icons into public/. Run `npm run logo` after changing the drawing, then commit
// the images. Needs Playwright's Chromium, like scripts/og/make.mjs.
//   logo-132.png, logo-512.png   the logo: a red disc with a white piece-shaped line around 将, and ישראל under it (transparent)
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

// The piece line: the same five-sided shape as the site's own icons (src/lib/icons.ts), drawn on a 100×100 grid.
const PIECE = [[50, 3], [79.7, 21.8], [88.1, 97], [11.9, 97], [20.3, 21.8]];

const path = (pts) => 'M' + pts.map((p) => p.map((v) => v.toFixed(2)).join(' ')).join('L') + 'Z';

function logo(bg) {
  // The piece line fits snugly around 将, with ישראל under it. The three are laid out at size, centred as one
  // block, then scaled up together to fill the disc. Ink sizes below are measured from the two faces.
  const k = 0.46, kanji = 27, he = 12, gap = 3.5, grow = 1.3;
  const height = 94 * k + gap + 0.758 * he;
  const top = 50 - height / 2;
  const piece = PIECE.map(([x, y]) => [50 + (x - 50) * k, top + (y - 3) * k]);
  let area = 0, cy = 0;
  piece.forEach(([x0, y0], i) => {
    const [x1, y1] = piece[(i + 1) % piece.length];
    const c = x0 * y1 - x1 * y0;
    area += c / 2;
    cy += (y0 + y1) * c;
  });
  cy /= 6 * area;
  const kanjiBase = cy - (31.3 / 33) * kanji / 2 + (28.4 / 33) * kanji;
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    ${bg ? `<rect width="100" height="100" fill="${bg}"/>` : ''}
    <g ${bg ? 'transform="translate(50 50) scale(.8) translate(-50 -50)"' : ''}>
      <circle cx="50" cy="50" r="50" fill="${C.seal}"/>
      <g transform="translate(50 50) scale(${grow}) translate(-50 -50)">
        <path d="${path(piece)}" fill="none" stroke="${C.white}" stroke-width="1.7" stroke-linejoin="round"/>
        <text x="50" y="${kanjiBase.toFixed(2)}" text-anchor="middle" font-family="Shippori Mincho" font-weight="800" font-size="${kanji}" fill="${C.white}">将</text>
        <text x="50" y="${(top + height).toFixed(2)}" text-anchor="middle" direction="rtl" font-family="Heebo Variable" font-weight="800" font-size="${he}" fill="${C.white}">ישראל</text>
      </g>
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
