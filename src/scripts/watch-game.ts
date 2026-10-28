// The first-game island (/try/): one game, one move per click, with a plain explanation beside the board.
// Nothing plays by itself (Dean's rule). Board: shogiground in the lesson skin, view only, never mirrored,
// set up like the KIF viewer (src/scripts/kif-viewer.ts). The game and its texts: src/lib/first-game.ts.
import { Shogiground } from 'shogiground/shogiground';
import { makeSquareName, parseUsi } from 'shogiops/util';
import { FIRST_GAME, PHASES, PIECE_TOKEN, TAG_LABEL, firstGamePlies, plainText } from '../lib/first-game';
import { markSeen } from '../lib/progress-local';
import { playStep, preloadSounds } from '../learn/sound';

/** Fill an element with text whose {R} marks become pieces drawn like the board's (styles: .pchip in /try/). */
function setRich(el: HTMLElement, text: string): void {
  const parts = text.split(PIECE_TOKEN); // odd indexes are the captured piece codes
  el.replaceChildren(...parts.map((p, i) => {
    if (i % 2 === 0) return document.createTextNode(p);
    const chip = document.createElement('span');
    chip.className = 'pchip';
    chip.dataset.p = p;
    chip.setAttribute('aria-hidden', 'true'); // the piece's name is always written next to it
    return chip;
  }));
}

export function bootWatchGame(root: HTMLElement): void {
  const q = <T extends HTMLElement = HTMLElement>(s: string) => root.querySelector<T>(s)!;
  const plies = firstGamePlies();
  const N = FIRST_GAME.length;
  const SUMMARY = N + 1; // one step past the mate: the summary

  const ground = Shogiground({
    viewOnly: true,
    coordinates: { enabled: true, files: 'numeric', ranks: 'numeric' },
    highlight: { lastDests: true, check: true },
    hands: { inlined: true },
    drawable: { enabled: false, visible: false },
    animation: { enabled: !matchMedia('(prefers-reduced-motion: reduce)').matches },
  });
  ground.attach({ board: q('[data-sg]') });
  void preloadSounds();

  const next = q<HTMLButtonElement>('[data-next]');
  const nextLabel = q('[data-next-label]');
  const back = q<HTMLButtonElement>('[data-back]');
  const reset = q<HTMLButtonElement>('[data-reset]');
  const counter = q('[data-counter]');
  const live = q('[data-live]');
  const chips = [...root.querySelectorAll<HTMLElement>('[data-phase-chip]')];
  const panes = { intro: q('[data-pane="intro"]'), move: q('[data-pane="move"]'), summary: q('[data-pane="summary"]') };
  const phaseBox = q('[data-phase-box]');
  let step = 0;

  function show(n: number, announce = true) {
    const was = step;
    step = Math.max(0, Math.min(n, SUMMARY));
    const ply = plies[Math.min(step, N)];
    const [board, , hands] = ply.sfen.split(' ');
    const md = step > 0 ? parseUsi(FIRST_GAME[Math.min(step, N) - 1].usi) : undefined;
    ground.set({
      sfen: { board, hands },
      turnColor: ply.pos.turn,
      checks: ply.pos.isCheck(),
      lastDests: md ? ('role' in md ? [makeSquareName(md.to)] : [makeSquareName(md.from), makeSquareName(md.to)]) : [],
    });
    // one move forward sounds like a move on the board; jumps and steps back stay quiet
    if (md && step === was + 1 && step <= N) {
      const drop = 'role' in md;
      playStep(drop, !drop && !!plies[step - 1].pos.board.get(md.to), !drop && !!md.promotion, ply.pos.isCheck());
    }

    const phase = step === 0 ? -1 : step > N ? PHASES.length : ply.phase;
    chips.forEach((c, i) => {
      c.dataset.state = i === phase ? 'now' : i < phase ? 'done' : '';
      if (i === phase) c.setAttribute('aria-current', 'step');
      else c.removeAttribute('aria-current');
    });

    panes.intro.hidden = step !== 0;
    panes.move.hidden = step === 0 || step > N;
    panes.summary.hidden = step <= N;
    root.dataset.step = step === 0 ? 'intro' : step > N ? 'summary' : 'move';
    if (step === SUMMARY) markSeen('try-game'); // the course step (src/lib/curriculum.ts)

    if (step >= 1 && step <= N) {
      const m = FIRST_GAME[step - 1];
      const ph = PHASES[ply.phase];
      const starts = ph.first === step;
      phaseBox.hidden = !starts;
      if (starts) {
        q('[data-phase-name]').textContent = `שלב ${ply.phase + 1}: ${ph.name}`;
        setRich(q('[data-phase-note]'), ph.note);
      }
      q('[data-who]').textContent = `מהלך ${step} מתוך ${N} · ${step % 2 ? 'הפותח' : 'המשיב'}`;
      q('[data-tags]').replaceChildren(...ply.tags.map((t) => {
        const s = document.createElement('span');
        s.className = `tag tag--${t}`;
        s.textContent = TAG_LABEL[t];
        return s;
      }));
      q('[data-title]').textContent = m.title;
      setRich(q('[data-text]'), m.text);
      const why = q('[data-why]');
      why.hidden = !m.why;
      setRich(q('[data-why-text]'), m.why ?? '');
      if (announce) live.textContent = `מהלך ${step}: ${m.title}. ${plainText(m.text)}`;
    } else if (announce) {
      live.textContent = step === 0 ? 'עמדת הפתיחה' : 'סיכום המשחק';
    }

    next.hidden = step > N;
    nextLabel.textContent = step === 0 ? 'המהלך הראשון' : step === N ? 'לסיכום' : 'המהלך הבא';
    back.disabled = step === 0;
    reset.hidden = step < 2;
    counter.textContent = step === 0 ? `${N} מהלכים, משחק שלם` : step > N ? 'סיכום' : `מהלך ${step} מתוך ${N}`;
  }

  next.addEventListener('click', () => show(step + 1));
  back.addEventListener('click', () => show(step - 1));
  reset.addEventListener('click', () => { show(0); next.focus(); });
  q('[data-board]').addEventListener('keydown', (e) => {
    const k: Record<string, number> = { ArrowRight: step + 1, ArrowLeft: step - 1, Home: 0, End: N };
    if (e.key in k) { e.preventDefault(); show(k[e.key]); }
  });
  show(0, false);
}
