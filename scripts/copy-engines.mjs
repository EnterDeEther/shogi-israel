// Copy the two WebAssembly shogi engines from node_modules into public/engines/ (served as-is, not bundled).
// Runs before `astro dev` and `astro build` (package.json). Both engines are GPL-3.0; their licence files go along.
// AGPL-3.0-or-later, like the rest of this site.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const engines = [
  {
    from: 'node_modules/fairy-stockfish-nnue.wasm',
    to: 'public/engines/fairy-stockfish',
    files: ['stockfish.js', 'stockfish.wasm', 'stockfish.worker.js', 'Copying.txt', 'AUTHORS'],
  },
  {
    from: 'node_modules/@mizarjp/yaneuraou.k-p',
    to: 'public/engines/yaneuraou',
    files: ['lib/yaneuraou.k-p.js', 'lib/yaneuraou.k-p.wasm', 'lib/yaneuraou.k-p.worker.js', 'LICENSE.md', 'README.md'],
  },
];

for (const e of engines) {
  const dest = join(root, e.to);
  mkdirSync(dest, { recursive: true });
  for (const f of e.files) {
    const src = join(root, e.from, f);
    if (!existsSync(src)) throw new Error(`missing ${src}: run npm install`);
    copyFileSync(src, join(dest, f.split('/').pop()));
  }
}
console.log('engines copied to public/engines/');
