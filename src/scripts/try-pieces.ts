// Step two for newcomers (/try/pieces/): "שלוש דקות, שלושה כלים". Rook, bishop, pawn: one capture each,
// and every captured piece stays in your hand. Each exercise opens with what we learn, ends with feedback and a
// recap, and waits for the learner to press on (Dean's lesson rules: no auto-advance).
// Board: shogiground in the lesson skin, with the lesson player's helpers (dests without kings, arrows, sounds).
import { Shogiground } from 'shogiground/shogiground';
import { makeSfen, parseSfen } from 'shogiops/sfen';
import { makeSquareName, parseSquareName } from 'shogiops/util';
import type { Position } from 'shogiops/variant/position';
import { loadPrefs } from '../learn/prefs';
import { arrow } from '../learn/shapes';
import { illegalShogigroundMoveDests } from '../learn/shogi';
import { play, setSoundEnabled } from '../learn/sound';
import { markSeen } from '../lib/progress-local';

interface Exercise {
  name: string;
  sfen: string; // the hand carries over from the exercise before
  piece: Key;
  target: Key;
  learn: string;
  title: string;
  task: string;
  tip: string;
  /** Feedback for a move that does not capture yet. */
  moved: string;
  doneTitle: string;
  doneText: string;
  recap: string;
  next: string;
}

export const EXERCISES: Exercise[] = [
  {
    name: 'צריח',
    sfen: '9/4p4/9/9/9/9/4R4/9/9 b - 1',
    piece: '5g',
    target: '5b',
    learn: 'הצריח הוא אחד הכלים החזקים בשוגי. הוא נע בקו ישר, לכל כיוון, כמה משבצות שתרצה.',
    title: 'הצריח: כל הקו פתוח',
    task: 'העבר את הצריח אל הרגלי של היריב ולכוד אותו. לחץ על הצריח: הנקודות מראות לאן הוא יכול ללכת. אחר כך לחץ על המשבצת.',
    tip: 'כדי ללכוד כלי של היריב, נחת על המשבצת שלו.',
    moved: 'ככה הצריח זז: בקו ישר. עכשיו נסה להגיע אל הרגלי.',
    doneTitle: 'לכידה!',
    doneText: 'הצריח נע בקו ישר ולכד את הרגלי. הרגלי יצא מהלוח ועבר ליד שלך.',
    recap: 'הצריח נע בקווים ישרים, עד שהוא פוגש כלי. כלי שלכדת נשאר אצלך, ובהמשך נראה מה אפשר לעשות איתו.',
    next: 'הכלי הבא: רץ',
  },
  {
    name: 'רץ',
    sfen: '9/1s7/9/9/4B4/9/9/9/9 b P 1',
    piece: '5e',
    target: '8b',
    learn: 'הרץ נע באלכסון, לכל כיוון, כמה משבצות שתרצה.',
    title: 'הרץ: כל האלכסון פתוח',
    task: 'העבר את הרץ אל גנרל הכסף של היריב ולכוד אותו. הנקודות מראות את האלכסונים.',
    tip: 'הרץ לא קופץ מעל כלים. הוא עוצר כשהוא פוגש כלי.',
    moved: 'ככה הרץ זז: באלכסון. עכשיו נסה להגיע אל גנרל הכסף.',
    doneTitle: 'לכידה שנייה!',
    doneText: 'הרץ נע באלכסון ולכד את גנרל הכסף. עכשיו יש לך ביד שני כלים.',
    recap: 'הרץ נע באלכסונים, עד שהוא פוגש כלי. הצריח והרץ הם שני הכלים החזקים ביותר בתחילת המשחק.',
    next: 'הכלי האחרון: רגלי',
  },
  {
    name: 'רגלי',
    sfen: '9/9/9/9/3gbg3/4P4/9/9/9 b PS 1',
    piece: '5f',
    target: '5e',
    learn: 'הרגלי הוא הכלי הקטן ביותר. הוא נע צעד אחד קדימה, ולוכד גם הוא ישר קדימה. בשחמט חייל לוכד באלכסון, ובשוגי לא.',
    title: 'הרגלי: צעד אחד קדימה',
    task: 'לכוד את הרץ של היריב עם הרגלי. רק הכלי שמולך בטווח. הכלים שבאלכסון לא.',
    tip: 'הרגלי לא לוכד באלכסון, גם כשיש שם כלי.',
    moved: '',
    doneTitle: 'לכידה שלישית!',
    doneText: 'רגלי קטן לכד רץ גדול. עכשיו יש לך ביד שלושה כלים.',
    recap: 'הרגלי נע וגם לוכד צעד אחד קדימה. כל כלי נע בדרך שלו, וכל כלי שלכדת נשאר אצלך.',
    next: 'לסיום',
  },
];

export function bootTryPieces(root: HTMLElement): void {
  const q = <T extends HTMLElement = HTMLElement>(s: string) => root.querySelector<T>(s)!;
  const prefs = loadPrefs();
  setSoundEnabled(prefs.sound);
  const live = q('[data-live]');
  const chips = [...root.querySelectorAll<HTMLElement>('[data-chip]')];
  const ask = q('[data-pane="ask"]');
  const done = q('[data-pane="done"]');
  const end = q('[data-pane="end"]');
  const play_ = q('[data-play]');
  const feedback = q('[data-feedback]');
  let ex = 0;
  let pos: Position;

  const ground = Shogiground({
    coordinates: { enabled: true, files: 'numeric', ranks: 'numeric' },
    highlight: { lastDests: true, check: false },
    hands: { inlined: true },
    animation: { enabled: prefs.animation },
    drawable: { enabled: false, visible: true },
    premovable: { enabled: false },
    predroppable: { enabled: false },
    droppable: { free: false, dests: new Map() },
    movable: {
      free: false,
      showDests: true,
      events: { after: (orig: Key, dest: Key) => onMove(orig, dest) },
    },
  });
  ground.attach({ board: q('[data-sg]') });

  function setBoard() {
    const [board, , hands] = makeSfen(pos).split(' ');
    ground.set({
      sfen: { board, hands },
      turnColor: 'sente',
      activeColor: 'sente',
      movable: { dests: illegalShogigroundMoveDests(pos) },
    });
  }

  function start(n: number) {
    ex = n;
    const e = EXERCISES[n];
    pos = parseSfen('standard', e.sfen, false).unwrap();
    ground.set({ lastDests: [], selected: undefined });
    ground.setAutoShapes([]);
    setBoard();
    chips.forEach((c, i) => { c.dataset.state = i === n ? 'now' : i < n ? 'done' : ''; });
    q('[data-learn]').textContent = e.learn;
    q('[data-title]').textContent = e.title;
    q('[data-task]').textContent = e.task;
    q('[data-tip]').textContent = e.tip;
    feedback.hidden = true;
    ask.hidden = false;
    done.hidden = true;
    end.hidden = true;
    play_.hidden = false;
    root.dataset.state = 'ask';
    q('[data-board-label]').textContent = 'תורך';
    live.textContent = `${e.title}. ${e.task}`;
  }

  function onMove(orig: Key, dest: Key) {
    const e = EXERCISES[ex];
    const to = parseSquareName(dest)!;
    const captured = pos.board.get(to);
    pos.play({ from: parseSquareName(orig)!, to });
    pos.turn = 'sente'; // the opponent never moves here
    ground.setAutoShapes([]);
    if (captured && dest === e.target) {
      play('capture');
      setBoard();
      ground.set({ movable: { dests: new Map() } });
      finish();
      return;
    }
    play('move');
    setBoard();
    if (e.moved) {
      feedback.textContent = e.moved;
      feedback.hidden = false;
      live.textContent = e.moved;
    }
  }

  function finish() {
    const e = EXERCISES[ex];
    chips[ex].dataset.state = 'done';
    q('[data-done-title]').textContent = e.doneTitle;
    q('[data-done-text]').textContent = e.doneText;
    q('[data-recap]').textContent = e.recap;
    q('[data-next-label]').textContent = e.next;
    q('[data-board-label]').textContent = 'לכידה! הכלי עבר ליד שלך';
    ask.hidden = true;
    done.hidden = false;
    root.dataset.state = 'done';
    live.textContent = `${e.doneTitle} ${e.doneText}`;
    q<HTMLButtonElement>('[data-next]').focus({ preventScroll: true });
  }

  q('[data-hint]').addEventListener('click', () => {
    const e = EXERCISES[ex];
    const at = [...pos.board.color('sente')].map(makeSquareName)[0] as Key;
    ground.setAutoShapes([arrow(at ?? e.piece, e.target)]);
    feedback.textContent = 'החץ מראה את הדרך. לחץ על הכלי שלך, ואז על המשבצת שבסוף החץ.';
    feedback.hidden = false;
  });
  q('[data-show]').addEventListener('click', () => {
    // for anyone who can't (or doesn't want to) move a piece by hand: play the capture for them
    const at = [...pos.board.color('sente')].map(makeSquareName)[0] as Key;
    const e = EXERCISES[ex];
    const from = illegalShogigroundMoveDests(pos).get(at)?.includes(e.target) ? at : (start(ex), e.piece);
    ground.move(from, e.target); // an API move doesn't fire movable.events.after
    onMove(from, e.target);
  });
  q('[data-restart]').addEventListener('click', () => start(ex));
  q('[data-again]').addEventListener('click', () => start(ex));
  q('[data-next]').addEventListener('click', () => {
    if (ex + 1 < EXERCISES.length) {
      start(ex + 1);
      q<HTMLElement>('[data-ask-focus]').focus({ preventScroll: false });
    } else {
      done.hidden = true;
      play_.hidden = true;
      end.hidden = false;
      root.dataset.state = 'end';
      markSeen('try-pieces'); // the course step (src/lib/curriculum.ts)
      play('end');
      end.querySelector<HTMLElement>('h2')?.focus();
      end.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }
  });
  start(0);
}

