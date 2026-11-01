import { Shogiground } from 'shogiground/shogiground';
import { makeSfen } from 'shogiops/sfen';
import { makeSquareName, parseUsi } from 'shogiops/util';
import type { Position } from 'shogiops/variant/position';
import {
  LISHOGI_IMPORT_URL, type ParsedKif, copyText, downloadKif, endText, gamePositions, kifFileName, makeKif,
  parseKif, readKifFile, westernMove,
} from '../lib/kif';
import { playStep, preloadSounds } from '../learn/sound';
import { scrollWithin } from '../lib/scroll-within';
import { liveBounds } from '../lib/live-bounds';
import { SQUARE_RATIO } from '../lib/square-ratio';

export function bootKifViewer(root: HTMLElement): void {
  const q = <T extends HTMLElement = HTMLElement>(s: string) => root.querySelector<T>(s)!;
  const sgEl = q('[data-sg]');
  const list = q<HTMLOListElement>('[data-moves]');
  const counter = q('[data-counter]');
  const players = q('[data-players]');
  const status = q('[data-status]');
  const live = q('[data-live]');
  const input = q<HTMLTextAreaElement>('[data-input]');
  const file = q<HTMLInputElement>('[data-file]');
  const boardBox = q('[data-board]');

  const ground = liveBounds(Shogiground({
    viewOnly: true,
    squareRatio: SQUARE_RATIO,
    coordinates: { enabled: true, files: 'numeric', ranks: 'numeric' },
    highlight: { lastDests: true, check: true },
    hands: { inlined: true },
    drawable: { enabled: false, visible: false },
    animation: { enabled: !matchMedia('(prefers-reduced-motion: reduce)').matches },
  }));
  ground.attach({ board: sgEl });
  void preloadSounds();

  let game: ParsedKif;
  let positions: Position[] = [];
  let ply = 0;

  const say = (msg: string, kind: 'ok' | 'error' = 'ok') => {
    status.textContent = msg;
    status.dataset.kind = kind;
  };

  function show(n: number, announce = true) {
    const was = ply;
    ply = Math.max(0, Math.min(n, positions.length - 1));
    const pos = positions[ply];
    const [board, , hands] = makeSfen(pos).split(' ');
    const md = ply > 0 ? parseUsi(game.moves[ply - 1]) : undefined;
    ground.set({
      sfen: { board, hands },
      turnColor: pos.turn,
      checks: pos.isCheck(),
      lastDests: md ? ('role' in md ? [makeSquareName(md.to)] : [makeSquareName(md.from), makeSquareName(md.to)]) : [],
    });
    if (md && ply === was + 1) {
      const drop = 'role' in md;
      playStep(drop, !drop && !!positions[ply - 1].board.get(md.to), !drop && !!md.promotion, pos.isCheck());
    }
    counter.textContent = ply === 0 ? `עמדת הפתיחה · ${game.moves.length} מהלכים` : `מהלך ${ply} מתוך ${game.moves.length}`;
    list.querySelectorAll('button').forEach((b, i) => {
      const cur = i + 1 === ply;
      b.toggleAttribute('aria-current', cur);
      if (cur) scrollWithin(list, b);
    });
    if (announce) live.textContent = ply === 0 ? 'עמדת הפתיחה' : `מהלך ${ply}: ${list.children[ply - 1]?.textContent ?? ''}`;
  }

  function load(g: ParsedKif) {
    game = g;
    positions = gamePositions(g);
    const handicap = positions[0].turn === 'gote';
    const name = (n: string | undefined) => n || 'לא ידוע';
    players.replaceChildren(
      line(handicap ? 'מקבל הפור ☗' : 'הפותח ☗', name(g.sente)),
      line(handicap ? 'נותן הפור ☖' : 'המשיב ☖', name(g.gote)),
    );
    const end = endText(g.end, handicap);
    if (end) players.append(line('תוצאה', end));
    list.replaceChildren(...g.moves.map((usi, i) => {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      const w = document.createElement('bdi');
      w.dir = 'ltr';
      w.className = 'w';
      w.textContent = westernMove(positions[i], usi);
      const k = document.createElement('bdi');
      k.dir = 'ltr';
      k.className = 'k';
      k.lang = 'ja';
      k.textContent = g.kifMoves[i] ?? '';
      b.append(w, k);
      b.addEventListener('click', () => show(i + 1));
      li.append(b);
      return li;
    }));
    show(0, false);
  }

  function line(label: string, value: string) {
    const p = document.createElement('p');
    const s = document.createElement('strong');
    s.textContent = `${label}: `;
    const v = document.createElement('bdi');
    v.textContent = value;
    p.append(s, v);
    return p;
  }

  function tryLoad(text: string): boolean {
    const r = parseKif(text);
    if (!r.ok) {
      say(r.error, 'error');
      return false;
    }
    load(r.game);
    say(`נטען משחק של ${r.game.moves.length} מהלכים.`);
    return true;
  }

  const currentKif = () => makeKif(game);

  root.querySelectorAll<HTMLButtonElement>('[data-go]').forEach((b) =>
    b.addEventListener('click', () => {
      const go = b.dataset.go!;
      show(go === 'first' ? 0 : go === 'prev' ? ply - 1 : go === 'next' ? ply + 1 : positions.length - 1);
    }));
  boardBox.addEventListener('keydown', (e) => {
    const k: Record<string, number> = { ArrowRight: ply + 1, ArrowLeft: ply - 1, Home: 0, End: positions.length - 1 };
    if (e.key in k) { e.preventDefault(); show(k[e.key]); }
  });
  q('[data-flip]').addEventListener('click', () => ground.toggleOrientation());
  q('[data-load]').addEventListener('click', () => { if (tryLoad(input.value)) boardBox.focus(); });
  file.addEventListener('change', async () => {
    const f = file.files?.[0];
    if (!f) return;
    const text = await readKifFile(f);
    input.value = text;
    tryLoad(text);
    file.value = '';
  });
  q('[data-download]').addEventListener('click', () => {
    downloadKif(currentKif(), kifFileName({ date: game.date }));
    say('הקובץ ירד למכשיר שלך.');
  });
  q('[data-copy]').addEventListener('click', async () => {
    const ok = await copyText(currentKif());
    if (!ok) input.value = currentKif();
    say(ok ? 'רישום המשחק הועתק. אפשר להדביק אותו בכל מקום.' : 'ההעתקה לא הצליחה. הטקסט נמצא בתיבה למטה: ⟦סמן|סמני⟧ אותו ⟦והעתק|והעתיקי⟧.', ok ? 'ok' : 'error');
  });
  q('[data-lishogi]').addEventListener('click', async () => {
    const ok = await copyText(currentKif());
    window.open(LISHOGI_IMPORT_URL, '_blank', 'noopener');
    say(ok
      ? 'רישום המשחק הועתק. בליש׳וגי ⟦הדבק|הדביקי⟧ אותו בתיבה (Ctrl+V) ⟦ולחץ|ולחצי⟧ IMPORT GAME.'
      : 'פתחנו את ליש׳וגי. ⟦העתק|העתיקי⟧ את הטקסט מהתיבה למטה ⟦והדבק|והדביקי⟧ שם.');
    if (!ok) input.value = currentKif();
  });

  tryLoad(input.value);
  say('');
}
