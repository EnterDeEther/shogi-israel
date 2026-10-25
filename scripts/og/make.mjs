// Renders the share cards in src/lib/og-cards.ts to public/og/<slug>.png (1200×630).
// Run `npm run og` after changing a card, then commit the images. Needs Playwright's Chromium
// (npx playwright install chromium) on the machine that runs it; the live site never builds the card pages.
import { execSync } from 'node:child_process';
import { createReadStream, existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { extname, join } from 'node:path';

const root = new URL('../../', import.meta.url).pathname;
const out = join(root, '.og-build');
const target = join(root, 'public/og');

execSync(`npx astro build --outDir ${out}`, { cwd: root, stdio: 'inherit', env: { ...process.env, OG_RENDER: '1' } });

const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.woff2': 'font/woff2', '.woff': 'font/woff' };
const server = createServer((req, res) => {
  let file = join(out, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!file.startsWith(out) || !existsSync(file)) return res.writeHead(404).end();
  res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
}).listen(0);
const port = server.address().port;

const require = createRequire(import.meta.url); // CommonJS lookup, so a global Playwright install works too
const { chromium } = require('playwright');
const sharp = require('sharp'); // comes with Astro
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
const slugs = readdirSync(join(out, 'og-cards'));
for (const slug of slugs) {
  await page.goto(`http://localhost:${port}/og-cards/${slug}/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('body[data-ready]');
  const shot = await page.locator('[data-card]').screenshot();
  // A 256-colour palette keeps each card around 20 KB, with no visible difference.
  await sharp(shot).png({ palette: true, quality: 90, compressionLevel: 9, effort: 10 }).toFile(join(target, `${slug}.png`));
}
await browser.close();
server.close();
rmSync(out, { recursive: true, force: true });
console.log(`${slugs.length} cards in public/og/`);
