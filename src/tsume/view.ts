// Shogi Israel: the tsume player screen. Same frame as the game against the computer (play.css): the board
// with the pieces in hand, and beside it the table: which puzzle this is, what happened after the last move
// (right after each move, beside the board), the buttons, and the moves so far.
// AGPL-3.0-or-later, like the rest of this site.
import type { Role } from 'shogiops/types';
import { el, icon, pieceSetSwitch } from '../learn/view';
import type TsumeCtrl from './ctrl';
import { solvedList } from './puzzles';

const MARK: Record<Color, string> = { sente: '☗', gote: '☖' };

const ROLE: Partial<Record<Role, string>> = {
  rook: 'הצריח', bishop: 'הרץ', gold: 'הזהב', silver: 'הכסף', knight: 'הפרש', lance: 'הרומח', pawn: 'הרגלי',
  dragon: 'הדרקון', horse: 'הסוס', tokin: 'הטוקין', promotedsilver: 'הכסף המוכתר', promotedknight: 'הפרש המוכתר', promotedlance: 'הרומח המוכתר',
};

export const mateIn = (n: number): string => (n === 1 ? 'מט במהלך אחד' : `מט ב־${n} מהלכים`);
const yourMoves = (k: number): string => (k === 1 ? 'עוד מהלך אחד שלכם' : `עוד ${k} מהלכים שלכם`);

const extraIcons: Record<string, string> = {
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1.1 2h5c.1-.8.5-1.5 1.1-2A6 6 0 0 0 12 3z"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  'chev-left': '<path d="M15 6l-6 6 6 6"/>',
  'chev-right': '<path d="M9 6l6 6-6 6"/>',
};
function ticon(name: string): HTMLElement {
  if (!extraIcons[name]) return icon(name);
  const s = el('span', { class: 'icon', 'aria-hidden': 'true' });
  s.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${extraIcons[name]}</svg>`;
  return s;
}

export function mount(root: HTMLElement): { board: HTMLElement } {
  root.classList.add('play', 'tsume');
  root.replaceChildren(
    el('div', { class: 'play__main' },
      el('div', {
        class: 'play__board', dir: 'ltr', tabindex: '0', role: 'application',
        'aria-roledescription': 'לוח שוגי', 'aria-label': 'הלוח', 'aria-describedby': 'tsume-kbd-help', 'data-board': true,
      },
        el('div', { class: 'play__sgbox' },
          el('div', { class: 'play__sg', 'data-sg': true }),
          el('div', { class: 'kbd-cursor', 'aria-hidden': 'true', 'data-cursor': true }),
        ),
      ),
      el('p', { class: 'sr-only', id: 'tsume-kbd-help' }, 'משחקים במקלדת: חצים להזזת הסמן, Enter לבחירה ולמהלך, D לכלי מהיד, סימן שאלה לעזרה.'),
      el('div', { class: 'sr-only', 'aria-live': 'polite', 'data-live': true }),
    ),
    el('div', { class: 'play__table', 'data-table': true }),
  );
  return { board: root.querySelector<HTMLElement>('[data-sg]')! };
}

type Go = (fn: () => void) => (e: Event) => void;

function coach(ctrl: TsumeCtrl, go: Go): HTMLElement {
  const f = ctrl.feedback;
  const total = ctrl.puzzle.line.length;
  const left = Math.ceil((total - ctrl.step) / 2); // attacker moves still to play
  const btn = (label: string, fn: () => void, primary = false, fid?: string) =>
    el('button', { type: 'button', class: `btn${primary ? ' primary' : ''}`, 'data-fid': fid, onclick: go(fn) }, label);
  let cls = '';
  let title: string;
  const body: (HTMLElement | string | null)[] = [];
  switch (f.kind) {
    case 'intro':
      title = `תורכם. מצאו ${mateIn(ctrl.n)}.`;
      body.push(el('p', {}, 'אתם התוקף (☗, למטה). כל מהלך שלכם חייב להיות ', el('strong', {}, 'שח'),
        '. המגן (☖) עונה בהגנה הכי טובה, ובידו כל הכלים שלא נמצאים על הלוח או בידכם.'));
      break;
    case 'good':
      cls = 'good';
      title = 'נכון ✓';
      body.push(el('p', {}, ctrl.busy || !f.reply
        ? 'המגן עונה…'
        : el('span', {}, 'המגן ענה ', el('bdi', { dir: 'ltr', class: 'mv-name' }, f.reply), `. תורכם, ${yourMoves(left)} עד המט.`)));
      break;
    case 'not-check':
      cls = 'bad';
      title = 'זה לא שח';
      body.push(el('p', {}, 'בבעיית מט כל מהלך של התוקף חייב לתת שח. מהלך בלי שח נותן למגן זמן לברוח או להתגונן.'));
      body.push(el('div', { class: 'buttons' }, btn('נסו שוב', () => ctrl.retry(), true, 'retry')));
      break;
    case 'escape': {
      cls = 'bad';
      const lastMove = ctrl.line.plies.map((p) => p.color).lastIndexOf('sente') === total - 1;
      title = lastMove ? 'שח, אבל לא מט' : 'שח, אבל זה לא מספיק';
      body.push(el('p', {}, ctrl.busy
        ? 'המגן עונה…'
        : f.reply
          ? el('span', {}, 'המגן ענה ', el('bdi', { dir: 'ltr', class: 'mv-name' }, f.reply),
            lastMove ? ' ויצא מהשח.' : ', ומכאן כבר אין מט בזמן.')
          : 'למגן יש דרך לצאת מזה. נסו מהלך אחר.'));
      body.push(el('div', { class: 'buttons' }, btn('נסו שוב', () => ctrl.retry(), true, 'retry')));
      break;
    }
    case 'solved':
      cls = 'done';
      title = 'מט! ✓';
      body.push(el('p', {}, f.clean
        ? `פתרתם את בעיה ${ctrl.id}.`
        : 'הגעתם למט. הבעיה תסומן כפתורה כשתפתרו אותה בלי טעויות ובלי רמז.'));
      body.push(recap(ctrl));
      body.push(el('div', { class: 'buttons' },
        ctrl.id < ctrl.count ? btn('לבעיה הבאה', () => location.assign(`#${ctrl.id + 1}`), true, 'next') : null,
        btn('שוב', () => ctrl.load(ctrl.id), false, 'again')));
      break;
    case 'shown':
      cls = 'shown';
      title = 'הפתרון';
      body.push(el('p', {}, 'עברו על המהלכים עם החצים או ברשימה. כדאי לחזור לבעיה הזאת שוב בעוד כמה ימים.'));
      body.push(recap(ctrl));
      body.push(el('div', { class: 'buttons' },
        ctrl.id < ctrl.count ? btn('לבעיה הבאה', () => location.assign(`#${ctrl.id + 1}`), true, 'next') : null,
        btn('לנסות בעצמי', () => ctrl.load(ctrl.id), false, 'again')));
      break;
  }
  const hint = ctrl.hintRole();
  return el('div', { class: `tsume-coach ${cls}`, role: 'status', 'aria-live': 'polite' },
    el('strong', { class: 'title' }, title),
    ...body,
    hint ? el('p', { class: 'hint small' }, `רמז: ${hint.drop ? 'הציבו מהיד את ' : 'הזיזו את '}${ROLE[hint.role] ?? 'הכלי'} המסומן.`) : null,
  );
}

/** After the puzzle: the whole solution in our notation. */
function recap(ctrl: TsumeCtrl): HTMLElement {
  return el('p', { class: 'recap small' }, 'הפתרון: ',
    ...ctrl.line.plies.flatMap((p, i) => [i ? ' · ' : '', el('bdi', { dir: 'ltr' }, `${MARK[p.color]}${p.western}`)]));
}

function moveList(ctrl: TsumeCtrl, go: Go): HTMLElement {
  const plies = ctrl.line.plies;
  const current = ctrl.viewPly ?? plies.length;
  const list = el('ol', { class: 'moves', 'aria-label': 'המהלכים' });
  plies.forEach((p, i) => {
    list.append(el('li', {},
      el('button', {
        type: 'button', class: `mv${i + 1 === current ? ' active' : ''}`, disabled: !ctrl.done,
        'aria-current': i + 1 === current ? 'step' : undefined, onclick: go(() => ctrl.view(i + 1)),
      },
        el('span', { class: 'n' }, String(i + 1)),
        el('span', { class: 'mark', 'aria-hidden': 'true' }, MARK[p.color]),
        el('bdi', { dir: 'ltr' }, p.western),
      )));
  });
  const box = el('div', { class: 'moves-box', 'data-moves': true });
  box.append(plies.length ? list : el('p', { class: 'small muted empty' }, 'המהלכים יופיעו כאן.'));
  const nav = ctrl.done
    ? el('div', { class: 'replay-nav', role: 'group', 'aria-label': 'מעבר בין המהלכים' },
      el('button', { type: 'button', class: 'nav', 'aria-label': 'מהלך אחורה', title: 'מהלך אחורה', 'data-fid': 'back', disabled: current === 0, onclick: go(() => ctrl.stepView(-1)) }, ticon('chev-right')),
      el('button', { type: 'button', class: 'nav', 'aria-label': 'מהלך קדימה', title: 'מהלך קדימה', 'data-fid': 'fwd', disabled: current === plies.length, onclick: go(() => ctrl.stepView(1)) }, ticon('chev-left')))
    : null;
  return el('div', { class: 'replay' }, box, nav);
}

function tools(ctrl: TsumeCtrl, go: Go, openSettings: () => void): HTMLElement {
  const tool = (name: string, label: string, fn: () => void, disabled = false) =>
    el('button', { type: 'button', class: 'tool', 'data-fid': `tool-${name}`, title: label, disabled, onclick: go(fn) },
      ticon(name), el('span', { class: 'label' }, label));
  return el('div', { class: 'tools', role: 'group', 'aria-label': 'פעולות' },
    tool('chev-right', 'הקודמת', () => location.assign(`#${ctrl.id - 1}`), ctrl.id <= 1),
    tool('bulb', 'רמז', () => ctrl.hint(), ctrl.done || ctrl.busy),
    tool('eye', 'פתרון', () => ctrl.showSolution(), ctrl.done),
    tool('cog', 'הגדרות', openSettings),
    tool('chev-left', 'הבאה', () => location.assign(`#${ctrl.id + 1}`), ctrl.id >= ctrl.count),
  );
}

export function render(ctrl: TsumeCtrl, root: HTMLElement, openSettings: () => void): void {
  const focusedId = (document.activeElement as HTMLElement | null)?.dataset?.fid;
  const go: Go = (fn) => (e) => { e.preventDefault(); e.stopPropagation(); fn(); };
  const solved = solvedList(ctrl.n);
  const table = root.querySelector<HTMLElement>('[data-table]')!;
  table.replaceChildren(
    el('div', { class: 'table-box' },
      el('div', { class: 'tsume-head' },
        el('div', {},
          el('strong', {}, `בעיה ${ctrl.id}`, el('span', { class: 'muted' }, ` מתוך ${ctrl.count}`)),
          el('span', { class: 'small muted' }, `${mateIn(ctrl.n)}${ctrl.solved ? ' · פתרתם ✓' : ''}`)),
        el('span', { class: 'small muted solved-count' }, `פתרתם ${solved.length}`),
      ),
      coach(ctrl, go),
      tools(ctrl, go, openSettings),
      moveList(ctrl, go),
    ),
    el('div', { class: 'pieces-switch' }, pieceSetSwitch()),
  );
  const box = table.querySelector<HTMLElement>('[data-moves]');
  if (box) box.scrollTop = box.scrollHeight;
  if (focusedId) root.querySelector<HTMLElement>(`[data-fid="${focusedId}"]`)?.focus({ preventScroll: true });
}
