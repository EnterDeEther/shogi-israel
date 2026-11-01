import type { GameRecord } from '../play/record';
import { COURSE_KEY, emptyProgress, gameResult, INBOX_KEY, LEARN_KEY, normalize, RULES_PREFIX, TSUME_KEY, type CourseState, type InboxState, type SyncedProgress } from './progress-sync';

const HISTORY_KEY = 'shogi-il.play.history';

function readJson<T>(key: string, fallback: T): T {
  try {
    const v = JSON.parse(localStorage.getItem(key) || 'null');
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

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
  } catch { }
  const out = normalize({ ...p, tsume: readJson(TSUME_KEY, {}), course: readJson(COURSE_KEY, {}), inbox: readJson(INBOX_KEY, {}) });
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
    localStorage.setItem(INBOX_KEY, JSON.stringify(p.inbox));
  } catch { }
}

export function updateCourse(change: (c: CourseState) => void, opts: { overwrite?: boolean } = {}): SyncedProgress {
  const p = readLocal();
  change(p.course);
  try { localStorage.setItem(COURSE_KEY, JSON.stringify(p.course)); } catch { }
  document.dispatchEvent(new CustomEvent(opts.overwrite ? 'progress-reset' : 'progress-changed'));
  return p;
}

export function markSeen(id: string): void {
  if (readLocal().course.seen.includes(id)) return;
  updateCourse((c) => { c.seen = [...c.seen, id].sort(); });
}

export function updateInbox(change: (i: InboxState) => void): SyncedProgress {
  const p = readLocal();
  change(p.inbox);
  try { localStorage.setItem(INBOX_KEY, JSON.stringify(p.inbox)); } catch { }
  document.dispatchEvent(new CustomEvent('progress-changed'));
  return p;
}
