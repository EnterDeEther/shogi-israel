// AGPL-3.0-or-later, like the rest of this site.
import type { Role } from 'shogiops/types';
import { el, icon, nextInCourse, pieceSetSwitch } from '../learn/view';
import type TsumeCtrl from './ctrl';
import { solvedList } from './puzzles';
import { weekIndex, weekPuzzle, weekStreak, weeksHe, WEEK_LENGTH } from './week';
import { shareButton } from '../lib/share-card';
import { tipEl } from '../lib/info-tip-dom';

const MARK: Record<Color, string> = { sente: '☗', gote: '☖' };

const ROLE: Partial<Record<Role, string>> = {
  rook: 'הצריח', bishop: 'הרץ', gold: 'הזהב', silver: 'הכסף', knight: 'הפרש', lance: 'הרומח', pawn: 'הרגלי',
  dragon: 'הדרקון', horse: 'הסוס', tokin: 'הטוקין', promotedsilver: 'הכסף המוכתר', promotedknight: 'הפרש המוכתר', promotedlance: 'הרומח המוכתר',
};

export const mateIn = (n: number): string => (n === 1 ? 'מט במהלך אחד' : `מט ב־${n} מהלכים`);
const yourMoves = (k: number): string => (k === 1 ? 'עוד מהלך אחד שלך' : `עוד ${k} מהלכים שלך`);

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
      el('p', { class: 'sr-only', id: 'tsume-kbd-help' }, 'משחק במקלדת: חצים להזזת הסמן, Enter לבחירה ולמהלך, D לכלי מהיד, סימן שאלה לעזרה.'),
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
  const left = Math.ceil((total - ctrl.step) / 2);
  const btn = (label: string, fn: () => void, primary = false, fid?: string) =>
    el('button', { type: 'button', class: `btn${primary ? ' primary' : ''}`, 'data-fid': fid, onclick: go(fn) }, label);
  let cls = '';
  let title: string;
  const body: (HTMLElement | string | null)[] = [];
  switch (f.kind) {
    case 'intro':
      title = `תורך. ⟦מצא|מצאי⟧ ${mateIn(ctrl.n)}.`;
      body.push(el('p', {}, '⟦אתה|את⟧ ⟦התוקף|התוקפת⟧ (☗, למטה). כל מהלך שלך חייב להיות ', el('strong', {}, 'שח'),
        '. המגן (☖) עונה בהגנה הכי טובה, ובידו כל הכלים שלא נמצאים על הלוח או בידך.'));
      break;
    case 'good':
      cls = 'good';
      title = 'נכון ✓';
      body.push(el('p', {}, ctrl.busy || !f.reply
        ? 'המגן עונה…'
        : el('span', {}, 'המגן ענה ', el('bdi', { dir: 'ltr', class: 'mv-name' }, f.reply), `. תורך, ${yourMoves(left)} עד המט.`)));
      break;
    case 'not-check':
      cls = 'bad';
      title = 'זה לא שח';
      body.push(el('p', {}, 'בבעיית מט כל מהלך של התוקף חייב לתת שח. מהלך בלי שח נותן למגן זמן לברוח או להתגונן.'));
      body.push(el('div', { class: 'buttons' }, btn('⟦נסה|נסי⟧ שוב', () => ctrl.retry(), true, 'retry')));
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
          : 'למגן יש דרך לצאת מזה. ⟦נסה|נסי⟧ מהלך אחר.'));
      body.push(el('div', { class: 'buttons' }, btn('⟦נסה|נסי⟧ שוב', () => ctrl.retry(), true, 'retry')));
      break;
    }
    case 'solved':
      cls = 'done';
      title = 'מט! ✓';
      body.push(el('p', {}, f.clean
        ? `פתרת את בעיה ${ctrl.id}.`
        : 'הגעת למט. הבעיה תסומן כפתורה ⟦כשתפתור|כשתפתרי⟧ אותה בלי טעויות ובלי רמז.'));
      body.push(recap(ctrl));
      body.push(el('div', { class: 'buttons' },
        ctrl.id < ctrl.count ? btn('לבעיה הבאה', () => location.assign(`#${ctrl.id + 1}`), true, 'next') : null,
        btn('שוב', () => ctrl.load(ctrl.id), false, 'again')));
      if (f.clean) body.push(el('p', { class: 'small', 'data-signed-out-only': '' },
        el('a', { href: '/account/?mode=signup' }, '⟦פתח|פתחי⟧ חשבון בחינם'), ' והבעיות שפתרת יישמרו בכל מכשיר, ויספרו לנקודות ולדרגה שלך.'));
      if (f.clean && ctrl.n === WEEK_LENGTH && ctrl.id === weekPuzzle(weekIndex(), ctrl.count)) {
        const streak = weekStreak(solvedList(WEEK_LENGTH), ctrl.count);
        const text = `פתרתי את בעיית השבוע בשוגי ישראל${streak > 1 ? `, ${weeksHe(streak)} ברצף` : ''}`;
        body.push(el('p', { class: 'week-done' }, el('strong', {}, 'זו בעיית השבוע ✓'), streak > 1 ? ` רצף של ${weeksHe(streak)}.` : ' בעיה חדשה תעלה ביום ראשון.'));
        body.push(shareButton({ title: text, sub: 'בעיית מט אחת בכל שבוע. ⟦נסה|נסי⟧ גם ⟦אתה|את⟧', kanji: '詰', path: '/tsume/week/' }, 'shogi-israel-tsume.png'));
      }
      if (f.clean) { const next = nextInCourse(); if (next) body.push(next); }
      break;
    case 'shown':
      cls = 'shown';
      title = 'הפתרון';
      body.push(el('p', {}, '⟦עבור|עברי⟧ על המהלכים עם החצים או ברשימה. כדאי לחזור לבעיה הזאת שוב בעוד כמה ימים.'));
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
    hint ? el('p', { class: 'hint small' }, `רמז: ${hint.drop ? '⟦הצב|הציבי⟧ מהיד את ' : '⟦הזז|הזיזי⟧ את '}${ROLE[hint.role] ?? 'הכלי'} המסומן.`) : null,
  );
}

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
          el('span', { class: 'small muted' }, `${mateIn(ctrl.n)}${ctrl.solved ? ' · פתרת ✓' : ''}`)),
        el('span', { class: 'small muted solved-count' }, `פתרת ${solved.length}`),
      ),
      coach(ctrl, go),
      tools(ctrl, go, openSettings),
      moveList(ctrl, go),
    ),
    el('div', { class: 'pieces-switch' }, pieceSetSwitch(), tipEl('pieces')),
  );
  const box = table.querySelector<HTMLElement>('[data-moves]');
  if (box) box.scrollTop = box.scrollHeight;
  if (focusedId) root.querySelector<HTMLElement>(`[data-fid="${focusedId}"]`)?.focus({ preventScroll: true });
}
