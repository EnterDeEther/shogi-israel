// Signed-in visitors: a short note when something they finished earns points, and a bigger one on a new rank.
// Signed-out visitors (guest): the same points are counted from this device's progress and would be credited
// by an account, so they get a quieter note that says so, at most once every few minutes.
// Loaded by src/layouts/Base.astro next to the account sync. Points come from the saved progress
// (src/lib/xp.ts), so the note shows only what is new since the last time this device counted.
import { LEVEL_COUNTS } from './level-counts';
import { readLocal } from './progress-local';
import { rankFor, xpBreakdown } from './xp';

const SEEN = 'shogi-il.xp.seen';
const GUEST_LAST = 'shogi-il.xp.guestNote'; // sessionStorage: when the last guest note showed
const GUEST_GAP = 4 * 60 * 1000;

const current = () => xpBreakdown(readLocal(), LEVEL_COUNTS).total;
const readSeen = (): number | null => {
  try {
    const v = Number(localStorage.getItem(SEEN));
    return localStorage.getItem(SEEN) === null || !Number.isFinite(v) ? null : v;
  } catch { return null; }
};
const writeSeen = (xp: number) => { try { localStorage.setItem(SEEN, String(xp)); } catch { /* fine */ } };

let box: HTMLElement | null = null;
let timer: number | undefined;
function show(html: string, big: boolean, guest = false) {
  if (!box) {
    box = document.createElement('div');
    box.className = 'xp-toast';
    box.setAttribute('role', 'status');
    box.setAttribute('aria-live', 'polite');
    document.body.append(box);
  }
  box.innerHTML = html;
  box.classList.toggle('xp-toast--rank', big);
  box.classList.toggle('xp-toast--guest', guest);
  box.classList.add('xp-toast--on');
  clearTimeout(timer);
  timer = window.setTimeout(() => box?.classList.remove('xp-toast--on'), big || guest ? 6000 : 2500);
}

function guestNote(gain: number) {
  try {
    const last = Number(sessionStorage.getItem(GUEST_LAST)) || 0;
    if (Date.now() - last < GUEST_GAP) return;
    sessionStorage.setItem(GUEST_LAST, String(Date.now()));
  } catch { /* no storage: show it */ }
  const total = current();
  show(`<span><strong><bdi dir="ltr">+${gain}</bdi> נקודות</strong> (<bdi dir="ltr">${total}</bdi> בסך הכול). <a href="/account/?mode=signup">⟦פתח|פתחי⟧ חשבון בחינם</a> והן ייספרו לדרגה שלך.</span>`, false, true);
}

function check(guest: boolean) {
  const xp = current();
  const seen = readSeen();
  writeSeen(xp);
  if (seen === null || xp <= seen) return;
  if (guest) return guestNote(xp - seen);
  const before = rankFor(seen).rank;
  const now = rankFor(xp).rank;
  if (now.index > before.index) {
    show(`<span class="xp-toast__kanji" lang="ja" aria-hidden="true">${now.kanji}</span><span><strong>עלית דרגה: <span class="xp-toast__nw">${now.name}</span>!</strong> <a href="/course/">למסלול הלימוד האישי</a> · <a href="/ranks/#site">מה זה אומר?</a></span>`, true);
  } else {
    show(`<strong><bdi dir="ltr">+${xp - seen}</bdi></strong> נקודות`, false);
  }
}

export function startXpNotes(guest = false) {
  // first visit on this device, or progress that came from another device: count it quietly
  const quiet = () => writeSeen(current());
  if (readSeen() === null) quiet();
  document.addEventListener('progress-synced', quiet);
  document.addEventListener('progress-reset', quiet);
  document.addEventListener('progress-changed', () => setTimeout(() => check(guest), 0));
  document.addEventListener('shogi-il:game-end', () => setTimeout(() => check(guest), 0));
}
