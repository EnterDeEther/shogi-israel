// Shogi Israel: the computer opponent, running in the visitor's browser (no server).
// Two WebAssembly USI engines, both GPL-3.0, copied into /engines/ at build time (scripts/copy-engines.mjs):
//   Fairy-Stockfish (fairy-stockfish-nnue.wasm, classical evaluation) for levels 1-4,
//   YaneuraOu with the SuishoPetite K-P evaluation (@mizarjp/yaneuraou.k-p) for levels 5-10.
// Both are threaded builds: they need SharedArrayBuffer, so the page is served cross-origin isolated
// (COOP/COEP headers in vercel.json). We run one search thread, which is plenty at these time limits.
// AGPL-3.0-or-later, like the rest of this site.
import type { AiLevel, EngineName } from './levels';

interface EngineModule {
  addMessageListener(fn: (line: string) => void): void;
  postMessage(cmd: string): void;
  terminate?(): void;
}
type Factory = (opts?: { locateFile?: (file: string) => string }) => Promise<EngineModule>;

const SOURCES: Record<EngineName, { dir: string; script: string; global: string }> = {
  fairy: { dir: '/engines/fairy-stockfish/', script: 'stockfish.js', global: 'Stockfish' },
  yaneuraou: { dir: '/engines/yaneuraou/', script: 'yaneuraou.k-p.js', global: 'YaneuraOu_K_P' },
};

/** Can this browser run the engines? (threads need cross-origin isolation; both builds use WASM SIMD) */
export function engineSupport(): 'ok' | 'isolation' | 'wasm' {
  if (typeof WebAssembly !== 'object') return 'wasm';
  // smallest module that uses a SIMD instruction (v128.const + drop)
  const simd = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11]);
  if (!WebAssembly.validate(simd)) return 'wasm';
  if (!window.crossOriginIsolated || typeof SharedArrayBuffer !== 'function') return 'isolation';
  return 'ok';
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`could not load ${src}`));
    document.head.append(s);
  });
}

export interface SearchResult {
  usi: string; // a move, or 'resign' / 'win' (impasse declaration) as USI engines send them
}

export class UsiEngine {
  private pending?: (line: string) => void;
  private idle: Promise<void> = Promise.resolve();
  private searchId = 0;

  private constructor(readonly name: EngineName, private mod: EngineModule) {
    mod.addMessageListener((line) => this.pending?.(line));
  }

  static async load(name: EngineName): Promise<UsiEngine> {
    const src = SOURCES[name];
    const w = window as unknown as Record<string, Factory | undefined>;
    if (!w[src.global]) await loadScript(src.dir + src.script);
    const factory = w[src.global];
    if (!factory) throw new Error(`${name}: no engine factory`);
    const mod = await factory({ locateFile: (file) => src.dir + file });
    const engine = new UsiEngine(name, mod);
    await engine.handshake();
    return engine;
  }

  private send(cmd: string): void {
    this.mod.postMessage(cmd);
  }

  private waitFor(prefix: string): Promise<string> {
    return new Promise((resolve) => {
      this.pending = (line) => {
        if (line.startsWith(prefix)) {
          this.pending = undefined;
          resolve(line);
        }
      };
    });
  }

  private async handshake(): Promise<void> {
    const ok = this.waitFor('usiok');
    this.send('usi');
    await ok;
    this.send('setoption name Threads value 1');
    this.send('setoption name USI_Hash value 32');
    if (this.name === 'fairy') this.send('setoption name USI_Variant value shogi');
    else this.send('setoption name PvInterval value 0');
    const ready = this.waitFor('readyok');
    this.send('isready');
    await ready;
  }

  /** Best move for the position `sfen` + `moves` at the given level. Resolves undefined if cancelled. */
  search(sfen: string, moves: string[], level: AiLevel): Promise<SearchResult | undefined> {
    const id = ++this.searchId;
    const run = this.idle.then(async () => {
      if (id !== this.searchId) return undefined; // cancelled before it started
      if (this.name === 'fairy' && level.skill !== undefined) this.send(`setoption name Skill_Level value ${level.skill}`);
      this.send(`position sfen ${sfen}${moves.length ? ` moves ${moves.join(' ')}` : ''}`);
      const best = this.waitFor('bestmove');
      // Same limits Lishogi's shoginet sends: whichever comes first, depth or time.
      this.send(`go movetime ${level.movetime} depth ${level.depth}`);
      const line = await best;
      if (id !== this.searchId) return undefined;
      return { usi: line.split(/\s+/)[1] };
    });
    this.idle = run.then(() => undefined, () => undefined);
    return run;
  }

  /** Drop the search in progress (its answer is ignored) and any queued one. */
  cancel(): void {
    this.searchId++;
    if (this.pending) this.send('stop');
  }

}

const loading: Partial<Record<EngineName, Promise<UsiEngine>>> = {};
const loaded: UsiEngine[] = [];

/** One instance per engine for the page's lifetime; the download happens once. */
export function getEngine(name: EngineName): Promise<UsiEngine> {
  if (!loading[name]) {
    const p = UsiEngine.load(name);
    loading[name] = p;
    p.then((e) => loaded.push(e), () => delete loading[name]);
  }
  return loading[name];
}

/** Stop whatever the loaded engines are thinking about (never starts a download). */
export function cancelSearches(): void {
  for (const e of loaded) e.cancel();
}
