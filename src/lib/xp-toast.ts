// Signed-in visitors: a short note when something they finished earns points, and a bigger one on a new rank.
// Loaded by src/layouts/Base.astro next to the account sync. Points come from the saved progress
// (src/lib/xp.ts), so the note shows only what is new since the last time this device counted.
import { LEVEL_COUNTS } from './level-counts';
import { readLocal } from './progress-local';
import { rankFor, xpBreakdown } from './xp';

const SEEN = 'shogi-il.xp.seen';

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
function show(html: string, big: boolean) {
  if (!box) {
    box = document.createElement('div');
    box.className = 'xp-toast';
    box.setAttribute('role', 'status');
    box.setAttribute('aria-live', 'polite');
    document.body.append(box);
  }
  box.innerHTML = html;
  box.classList.toggle('xp-toast--rank', big);
  box.classList.add('xp-toast--on');
  clearTimeout(timer);
  timer = window.setTimeout(() => box?.classList.remove('xp-toast--on'), big ? 6000 : 2500);
}

function check() {
  const xp = current();
  const seen = readSeen();
  writeSeen(xp);
  if (seen === null || xp <= seen) return;
  const before = rankFor(seen).rank;
  const now = rankFor(xp).rank;
  if (now.index > before.index) {
    show(`<span class="xp-toast__kanji" lang="ja" aria-hidden="true">${now.kanji}</span><span><strong>עליתם דרגה: <span class="xp-toast__nw">${now.name}</span>!</strong> <a href="/course/">למסלול הלימוד האישי</a></span>`, true);
  } else {
    show(`<strong><bdi dir="ltr">+${xp - seen}</bdi></strong> נקודות`, false);
  }
}

export function startXpNotes() {
  // first visit on this device, or progress that came from another device: count it quietly
  const quiet = () => writeSeen(current());
  if (readSeen() === null) quiet();
  document.addEventListener('progress-synced', quiet);
  document.addEventListener('progress-reset', quiet);
  document.addEventListener('progress-changed', () => setTimeout(check, 0));
  document.addEventListener('shogi-il:game-end', () => setTimeout(check, 0));
}
