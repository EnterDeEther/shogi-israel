// This device's copy of the progress in src/lib/progress-sync.ts: where each part lives in localStorage.
// No Supabase here, so pages without an account (the course page, the home page) can read it cheaply.
import type { GameRecord } from '../play/record';
import { COURSE_KEY, emptyProgress, gameResult, LEARN_KEY, normalize, RULES_PREFIX, TSUME_KEY, type CourseState, type SyncedProgress } from './progress-sync';

const HISTORY_KEY = 'shogi-il.play.history'; // finished games on this device (src/play/record.ts)

function readJson<T>(key: string, fallback: T): T {
  try {
    const v = JSON.parse(localStorage.getItem(key) || 'null');
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

/** Highest level with a finished game, and with a win, in this device's game history. */
function fromHistory(): { played: number; won: number } {
  let played = 0;
  let won = 0;
  for (const r of readJson<GameRecord[]>(HISTORY_KEY, [])) {
    if (!r || typeof r.level !== 'number') continue;
    const res = gameResult(r);
    if (res === 'abort') continue;
    played = Math.max(played, r.level);
    if (res === 'win') won = Math.max(won, r.level);
  }
  return { played, won };
}

export function readLocal(): SyncedProgress {
  const p = emptyProgress();
  try {
    const learn = localStorage.getItem(LEARN_KEY);
    if (learn) p.learn = normalize({ learn: JSON.parse(learn) }).learn;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(RULES_PREFIX) && localStorage.getItem(k) === '1') p.rules.push(k.slice(RULES_PREFIX.length));
    }
  } catch { /* no storage: nothing local */ }
  const out = normalize({ ...p, tsume: readJson(TSUME_KEY, {}), course: readJson(COURSE_KEY, {}) });
  const h = fromHistory();
  out.course.played = Math.max(out.course.played, h.played);
  out.course.won = Math.max(out.course.won, h.won);
  return out;
}

export function writeLocal(p: SyncedProgress) {
  try {
    if (Object.keys(p.learn.stages).length) localStorage.setItem(LEARN_KEY, JSON.stringify(p.learn));
    else localStorage.removeItem(LEARN_KEY);
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith(RULES_PREFIX) && !p.rules.includes(k.slice(RULES_PREFIX.length))) localStorage.removeItem(k);
    }
    for (const id of p.rules) localStorage.setItem(RULES_PREFIX + id, '1');
    if (Object.keys(p.tsume).length) localStorage.setItem(TSUME_KEY, JSON.stringify(p.tsume));
    else localStorage.removeItem(TSUME_KEY);
    localStorage.setItem(COURSE_KEY, JSON.stringify(p.course));
  } catch { /* fine */ }
}

/** Change the course part on this device and tell the account sync (if any) about it. */
export function updateCourse(change: (c: CourseState) => void, opts: { overwrite?: boolean } = {}): SyncedProgress {
  const p = readLocal();
  change(p.course);
  try { localStorage.setItem(COURSE_KEY, JSON.stringify(p.course)); } catch { /* not saved; fine */ }
  // An undo (un-skip, new starting point) must replace the account's copy, not be merged back from it.
  document.dispatchEvent(new CustomEvent(opts.overwrite ? 'progress-reset' : 'progress-changed'));
  return p;
}
