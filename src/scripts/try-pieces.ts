import { Shogiground } from 'shogiground/shogiground';
import { makeSfen, parseSfen } from 'shogiops/sfen';
import { makeSquareName, parseSquareName } from 'shogiops/util';
import type { Position } from 'shogiops/variant/position';
import { loadPrefs } from '../learn/prefs';
import { arrow } from '../learn/shapes';
import { illegalShogigroundMoveDests } from '../learn/shogi';
import { play, preloadSounds } from '../learn/sound';
import { markSeen } from '../lib/progress-local';
import { liveBounds } from '../lib/live-bounds';
import { SQUARE_RATIO } from '../lib/square-ratio';

interface Exercise {
  name: string;
  sfen: string;
  piece: Key;
  target: Key;
  learn: string;
  title: string;
  task: string;
  tip: string;
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
    learn: 'הצריח נע קדימה, אחורה, ימינה או שמאלה, כמה משבצות ⟦שתרצה|שתרצי⟧.',
    title: 'הצריח: כל הקו פתוח',
    task: '⟦לכוד|לכדי⟧ עם הצריח את החייל של היריב. ⟦לחץ|לחצי⟧ על הצריח, ואז על החייל.',
    tip: 'כשלוחצים על הצריח, מופיעות נקודות שמראות לאן הוא יכול לזוז.',
    moved: 'ככה הצריח זז: בקו ישר. עכשיו ⟦נסה|נסי⟧ להגיע אל החייל.',
    doneTitle: 'לכידה!',
    doneText: 'החייל של היריב יצא מהלוח, ועכשיו הוא ביד שלך.',
    recap: 'הצריח נע ישר עד הכלי הראשון שבדרך. כאן זה היה החייל של היריב, ולכן הצריח יכול היה ללכוד אותו.',
    next: 'הכלי הבא: רץ',
  },
  {
    name: 'רץ',
    sfen: '9/1r7/9/9/4B4/9/9/9/9 b P 1',
    piece: '5e',
    target: '8b',
    learn: 'הרץ נע באלכסון, לכל כיוון, כמה משבצות ⟦שתרצה|שתרצי⟧.',
    title: 'הרץ: כל האלכסון פתוח',
    task: '⟦לכוד|לכדי⟧ עם הרץ את הכלי של היריב.',
    tip: '⟦חפש|חפשי⟧ את האלכסון שמוביל מהרץ אל הכלי של היריב.',
    moved: 'ככה הרץ זז: באלכסון. עכשיו ⟦נסה|נסי⟧ להגיע אל הכלי של היריב.',
    doneTitle: 'לכידה שנייה!',
    doneText: 'עכשיו יש לך ביד שני כלים.',
    recap: 'הרץ נע באלכסון עד הכלי הראשון שבדרך. האלכסון אל הכלי של היריב היה פנוי, ולכן הרץ יכול היה ללכוד אותו.',
    next: 'הכלי האחרון: חייל',
  },
  {
    name: 'חייל',
    sfen: '9/9/9/9/3gbg3/4P4/9/9/9 b RP 1',
    piece: '5f',
    target: '5e',
    learn: 'החייל נע משבצת אחת ישר קדימה, ולוכד באותו כיוון.',
    title: 'החייל: צעד אחד קדימה',
    task: '⟦לכוד|לכדי⟧ עם החייל את הרץ של היריב, שעומד ישר מולו.',
    tip: 'החייל לא לוכד באלכסון, גם כשיש שם כלי.',
    moved: '',
    doneTitle: 'לכידה שלישית!',
    doneText: 'חייל קטן לכד רץ גדול. עכשיו יש לך ביד שלושה כלים.',
    recap: 'החייל לוכד רק ישר קדימה, ולכן שני הכלים שעמדו באלכסון לפניו היו בטוחים.',
    next: 'לסיום',
  },
];

export function bootTryPieces(root: HTMLElement): void {
  const q = <T extends HTMLElement = HTMLElement>(s: string) => root.querySelector<T>(s)!;
  const prefs = loadPrefs();
  void preloadSounds();
  const live = q('[data-live]');
  const chips = [...root.querySelectorAll<HTMLElement>('[data-chip]')];
  const ask = q('[data-pane="ask"]');
  const done = q('[data-pane="done"]');
  const end = q('[data-pane="end"]');
  const play_ = q('[data-play]');
  const feedback = q('[data-feedback]');
  let ex = 0;
  let pos: Position;

  const ground = liveBounds(Shogiground({
    squareRatio: SQUARE_RATIO,
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
  }));
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
    q('[data-task]').replaceChildren(Object.assign(document.createElement('mark'), { className: 'learn-task', textContent: e.task }));
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
    pos.turn = 'sente';
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
    q('[data-board-label]').textContent = 'לכידה! הכלי עכשיו ביד שלך';
    ask.hidden = true;
    done.hidden = false;
    root.dataset.state = 'done';
    live.textContent = `${e.doneTitle} ${e.doneText}`;
    q<HTMLButtonElement>('[data-next]').focus({ preventScroll: true });
  }

  q('[data-hint]').addEventListener('click', () => {
    const e = EXERCISES[ex];
    const at = [...pos.board.color('sente')].map(makeSquareName)[0] as Key;
    const from = at && illegalShogigroundMoveDests(pos).get(at)?.includes(e.target) ? at : (start(ex), e.piece);
    ground.setAutoShapes([arrow(from, e.target)]);
    feedback.textContent = '⟦לחץ|לחצי⟧ על הכלי שלך, ואז על המשבצת שבסוף החץ הירוק.';
    feedback.hidden = false;
  });
  q('[data-show]').addEventListener('click', () => {
    const at = [...pos.board.color('sente')].map(makeSquareName)[0] as Key;
    const e = EXERCISES[ex];
    const from = illegalShogigroundMoveDests(pos).get(at)?.includes(e.target) ? at : (start(ex), e.piece);
    ground.move(from, e.target);
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
      markSeen('try-pieces');
      play('end');
      end.querySelector<HTMLElement>('h2')?.focus();
      end.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }
  });
  start(0);
}

