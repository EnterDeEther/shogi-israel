import { readTourEnd } from '../lib/tour';
import type PlayCtrl from './ctrl';
import { loadHistory, savedGame } from './record';

export type PlayTip = 'capture' | 'captured' | 'promote';

export const TIPS_KEY = 'shogi-il.play-tips';

type Store = Pick<Storage, 'getItem' | 'setItem'>;
const local = (): Store | undefined => {
  try { return localStorage; } catch { return undefined; }
};

function readTips(store: Store | undefined): Partial<Record<PlayTip, 1>> | null {
  try {
    const v = JSON.parse(store?.getItem(TIPS_KEY) || 'null');
    return v && typeof v === 'object' ? v : null;
  } catch { return null; }
}

export function newHere(ctrl: Pick<PlayCtrl, 'record'>, store: Store | undefined = local()): boolean {
  if (ctrl.record || readTourEnd(store, 'play') !== null || readTips(store)) return false;
  return loadHistory().length === 0 && !savedGame('ai') && !savedGame('local');
}

export function welcomeTips(store: Store | undefined = local()): void {
  try { if (!readTips(store)) store?.setItem(TIPS_KEY, '{}'); } catch { }
}

export function tipDue(tip: PlayTip, store: Store | undefined = local()): boolean {
  const tips = readTips(store);
  return !!tips && !tips[tip];
}

export function tipSeen(tip: PlayTip, store: Store | undefined = local()): void {
  const tips = readTips(store);
  if (!tips) return;
  try { store?.setItem(TIPS_KEY, JSON.stringify({ ...tips, [tip]: 1 })); } catch { }
}

export const TIP_TEXT: Record<PlayTip, { title: string; body: string }> = {
  capture: {
    title: 'לכדת כלי!',
    body: 'הכלי עבר לצד שלך ומחכה ביד, מתחת ללוח. בתור שלך אפשר ללחוץ עליו ואז על משבצת פנויה: זו הצנחה, והיא המהלך שלך באותו תור.',
  },
  captured: {
    title: 'המחשב לכד כלי שלך',
    body: 'בשוגי כלי שנלכד עובר לצד של מי שלכד אותו. עכשיו הוא ביד של המחשב, מעל הלוח, והמחשב יכול להצניח אותו על משבצת פנויה במקום מהלך רגיל.',
  },
  promote: {
    title: 'הכתרה',
    body: 'הכלי נכנס לשלוש השורות האחרונות, אז אפשר להכתיר אותו: הוא הופך לכלי חזק יותר, ומסומן באדום. ⟦בחר|בחרי⟧ את הכלי האדום כדי להכתיר, או את הרגיל כדי להשאיר אותו כמו שהוא.',
  },
};

const frame = () => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done())));

export async function playTour(ctrl: PlayCtrl, intro: boolean, from?: HTMLElement | null): Promise<void> {
  const root = document.querySelector<HTMLElement>('.play');
  const box = root?.querySelector<HTMLElement>('.play__sgbox');
  if (!root || !box || ctrl.local || !ctrl.record) return;
  ctrl.hold();
  await frame();
  const sg = box.querySelector<HTMLElement>('[data-sg]');
  const board = sg?.querySelector<HTMLElement>('sg-board');
  sg?.setAttribute('data-tour', 'play-armies');
  sg?.querySelector('sg-hand-wrap.hand-bottom')?.setAttribute('data-tour', 'play-hand');
  let zone = box.querySelector<HTMLElement>('.play__zone');
  if (!zone) {
    zone = document.createElement('div');
    zone.className = 'play__zone';
    zone.setAttribute('aria-hidden', 'true');
    zone.dataset.tour = 'play-zone';
    box.append(zone);
  }
  const place = () => {
    if (!board || !zone) return;
    const b = board.getBoundingClientRect(), o = box.getBoundingClientRect();
    Object.assign(zone.style, { top: `${b.top - o.top}px`, left: `${b.left - o.left}px`, width: `${b.width}px`, height: `${b.height / 3}px` });
  };
  place();
  const watch = typeof ResizeObserver === 'function' ? new ResizeObserver(place) : undefined;
  if (board) watch?.observe(board);
  const done = () => {
    watch?.disconnect();
    ctrl.release();
  };
  let started = false;
  try {
    const { startTour } = await import('../scripts/tour');
    const onEnd = (e: Event) => {
      if ((e as CustomEvent<{ id: string }>).detail?.id !== 'play') return;
      document.removeEventListener('tour-end', onEnd);
      done();
    };
    document.addEventListener('tour-end', onEnd);
    started = startTour('play', from, { at: intro ? -1 : 0 });
    if (!started) document.removeEventListener('tour-end', onEnd);
  } finally {
    if (!started) done();
  }
}
