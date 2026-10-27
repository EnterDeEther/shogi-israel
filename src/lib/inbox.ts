// The inbox (התראות) for signed-in visitors: short notes behind the bell in the header. Almost every note is
// worked out from the progress the account already keeps (src/lib/progress-sync.ts), so nothing is stored
// twice and nothing needs a server job: a new rank, the next step on the course path, the puzzle of the week,
// a weekly streak about to break, a lesson started and not finished, a game left open on this device.
// Only site news comes from the server (the `notices` table, supabase/migrations/0005_notifications.sql).
// Each note has a stable id, so "read" survives reloads and follows the account (SyncedProgress.inbox).
// Pure functions (tested in test/inbox.test.ts); src/lib/inbox-ui.ts draws the bell and the list.
import { stageUrl } from '../learn/urls';
import { CURRICULUM, nextStep, stageDone, stepHref, KIND_LABEL } from './curriculum';
import type { InboxGroup, SyncedProgress } from './progress-sync';
import { rankFor, xpBreakdown } from './xp';
import { weekIndex, weekPuzzle, weekStreak, weeksHe } from '../tsume/week';

export type InboxKind = 'news' | 'rank' | 'week' | 'streak' | 'next' | 'stage' | 'game';

export interface InboxNote {
  id: string;
  kind: InboxKind;
  /** One or two kanji for the round badge (decoration only). */
  kanji: string;
  /** The note, plain text (drawn with textContent). */
  text: string;
  href: string;
  cta: string;
  /** A short line under the note, e.g. "במכשיר הזה". */
  sub?: string;
}

/** Site news, as stored in the `notices` table. */
export interface Notice { id: number; title: string; body?: string | null; url?: string | null }

/** A game against the computer still in progress on this device (src/play/ctrl.ts saves it). */
export interface OpenGame { id: string; level: number; moves: number }

export interface InboxContext {
  levelCounts: Record<string, number>;
  /** Puzzles in the mate-in-3 collection, for the puzzle of the week. */
  weekCount: number;
  now?: Date;
  openGame?: OpenGame | null;
  notices?: Notice[];
}

/** Which settings switch hides which notes. */
export const GROUP_OF: Record<InboxKind, InboxGroup> = {
  news: 'news', rank: 'rank', week: 'week', streak: 'week', next: 'path', stage: 'path', game: 'path',
};

export const GROUP_LABEL: Record<InboxGroup, { title: string; sub: string }> = {
  path: { title: 'המסלול שלי', sub: 'הצעד הבא, שיעור שהתחלת ומשחק פתוח' },
  week: { title: 'בעיית השבוע', sub: 'בעיה חדשה בכל יום ראשון, ותזכורת כשהרצף בסכנה' },
  rank: { title: 'דרגות', sub: '⟦כשאתה|כשאת⟧ עולה דרגה' },
  news: { title: 'חדשות האתר', sub: 'שיעורים וכלים חדשים' },
};

/** Thursday (4) to Saturday: late enough in the week to warn that a streak is about to break. */
const STREAK_WARN_DAY = 4;

export function buildInbox(p: SyncedProgress, ctx: InboxContext): InboxNote[] {
  const now = ctx.now ?? new Date();
  const notes: InboxNote[] = [];

  for (const n of ctx.notices ?? []) {
    notes.push({ id: `news:${n.id}`, kind: 'news', kanji: '報', text: n.body ? `${n.title}: ${n.body}` : n.title, href: n.url || '/', cta: 'לפרטים' });
  }

  const { rank, next } = rankFor(xpBreakdown(p, ctx.levelCounts).total);
  if (rank.index > 0) {
    notes.push({
      id: `rank:${rank.index}`, kind: 'rank', kanji: rank.kanji,
      text: `עלית לדרגה ${rank.name} במסלול!${next ? ` הדרגה הבאה: ${next.name}.` : ''}`,
      href: '/course/', cta: 'למסלול',
    });
  }

  if (ctx.weekCount > 0) {
    const week = weekIndex(now);
    const solved = p.tsume['3'] ?? [];
    const id = weekPuzzle(week, ctx.weekCount);
    if (!solved.includes(id)) {
      const streak = weekStreak(solved, ctx.weekCount, week); // weeks in a row up to last week
      if (streak >= 2 && now.getDay() >= STREAK_WARN_DAY) {
        notes.push({
          id: `streak:${week}`, kind: 'streak', kanji: '続',
          text: `פתרת את בעיית השבוע ${weeksHe(streak)} ברצף. השבוע נגמר בשבת: ⟦פתור|פתרי⟧ את הבעיה כדי לשמור על הרצף.`,
          href: '/tsume/3/', cta: 'לבעיית השבוע',
        });
      } else {
        notes.push({
          id: `week:${week}`, kind: 'week', kanji: '詰',
          text: 'בעיית השבוע החדשה מחכה לך: מט בשלושה מהלכים.',
          href: '/tsume/3/', cta: 'לבעיית השבוע',
        });
      }
    }
  }

  const step = p.course.track ? nextStep(p, ctx.levelCounts)?.step : undefined;
  if (!p.course.track) {
    notes.push({ id: 'next:start', kind: 'next', kanji: '歩', text: 'עוד לא בחרת מאיפה להתחיל. שאלה אחת, ⟦ותקבל|ותקבלי⟧ מסלול לימוד אישי.', href: '/course/', cta: '⟦בחר|בחרי⟧ נקודת התחלה' });
  } else if (step) {
    notes.push({
      id: `next:${step.id}`, kind: 'next', kanji: '歩',
      text: `הצעד הבא במסלול שלך: ${step.title.replace(/^תרגול: /, '')} (${KIND_LABEL[step.kind]}).`,
      href: stepHref(step, p, ctx.levelCounts), cta: '⟦המשך|המשיכי⟧',
    });
  }

  // A Learn stage started and left half-way (the first one on the path), unless it is the next step anyway.
  const half = halfDoneStage(p, ctx.levelCounts, step?.learn ?? []);
  if (half) {
    notes.push({
      id: `stage:${half.key}`, kind: 'stage', kanji: '習',
      text: `התחלת ולא סיימת: ${half.title}. נשארו ${half.left === 1 ? 'תרגיל אחד' : `${half.left} תרגילים`}.`,
      href: stageUrl(half.key), cta: '⟦המשך|המשיכי⟧ מאיפה שעצרת',
    });
  }

  if (ctx.openGame && ctx.openGame.moves > 0) {
    notes.push({
      id: `game:${ctx.openGame.id}`, kind: 'game', kanji: '対',
      text: `יש לך משחק פתוח נגד המחשב (רמה ${ctx.openGame.level}, אחרי ${ctx.openGame.moves} מהלכים).`,
      href: '/play/', cta: 'חזרה למשחק', sub: 'במכשיר הזה',
    });
  }

  return notes.filter((n) => !p.inbox.off.includes(GROUP_OF[n.kind]));
}

function halfDoneStage(p: SyncedProgress, levelCounts: Record<string, number>, skip: string[]) {
  for (const unit of CURRICULUM) {
    for (const s of unit.steps) {
      for (const key of s.learn ?? []) {
        if (skip.includes(key) || stageDone(key, p, levelCounts)) continue;
        const n = levelCounts[key] ?? 0;
        const done = (p.learn.stages[key]?.scores ?? []).slice(0, n).filter((x) => x > 0).length;
        if (done > 0) return { key, title: s.title.replace(/^תרגול: /, ''), left: n - done };
      }
    }
  }
  return null;
}

export const unread = (notes: InboxNote[], p: SyncedProgress): InboxNote[] => notes.filter((n) => !p.inbox.read.includes(n.id));

/** The saved game in progress (localStorage 'shogi-il.play.current'), if it is still being played. */
export function openGameFrom(raw: string | null): OpenGame | null {
  try {
    const saved = JSON.parse(raw || 'null');
    const r = saved?.record;
    if (!r || r.version !== 1 || r.result || !Array.isArray(r.moves) || typeof r.id !== 'string') return null;
    return { id: r.id.slice(0, 40), level: Number(r.level) || 1, moves: r.moves.length };
  } catch {
    return null;
  }
}
