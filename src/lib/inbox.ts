import { stageUrl } from '../learn/urls';
import { curriculumFor, nextStep, stageDone, stepHref, KIND_LABEL } from './curriculum';
import type { InboxGroup, SyncedProgress } from './progress-sync';
import { rankFor, xpBreakdown } from './xp';
import { weekIndex, weekPuzzle, weekStreak, weeksHe } from '../tsume/week';

export type InboxKind = 'news' | 'rank' | 'week' | 'streak' | 'next' | 'stage' | 'game';

export interface InboxNote {
  id: string;
  kind: InboxKind;
  kanji: string;
  text: string;
  href: string;
  cta: string;
  sub?: string;
}

export interface Notice { id: number; title: string; body?: string | null; url?: string | null }

export interface OpenGame { id: string; level: number; moves: number }

export interface InboxContext {
  levelCounts: Record<string, number>;
  weekCount: number;
  now?: Date;
  openGame?: OpenGame | null;
  notices?: Notice[];
}

export const GROUP_OF: Record<InboxKind, InboxGroup> = {
  news: 'news', rank: 'rank', week: 'week', streak: 'week', next: 'path', stage: 'path', game: 'path',
};

export const GROUP_LABEL: Record<InboxGroup, { title: string; sub: string }> = {
  path: { title: 'המסלול שלי', sub: 'הצעד הבא, שיעור שהתחלת ומשחק פתוח' },
  week: { title: 'בעיית השבוע', sub: 'בעיה חדשה בכל יום ראשון, ותזכורת כשהרצף בסכנה' },
  rank: { title: 'דרגות', sub: '⟦כשאתה|כשאת⟧ עולה דרגה' },
  news: { title: 'חדשות האתר', sub: 'שיעורים וכלים חדשים' },
};

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
      const streak = weekStreak(solved, ctx.weekCount, week);
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

  const step = p.course.route ? nextStep(p, ctx.levelCounts)?.step : undefined;
  if (!p.course.route) {
    notes.push({ id: 'next:start', kind: 'next', kanji: '歩', text: 'עוד לא בחרת מאיפה להתחיל. שתי שאלות קצרות, ⟦ותקבל|ותקבלי⟧ מסלול לימוד אישי.', href: '/course/', cta: '⟦בחר|בחרי⟧ נקודת התחלה' });
  } else if (step) {
    notes.push({
      id: `next:${step.id}`, kind: 'next', kanji: '歩',
      text: `הצעד הבא במסלול שלך: ${step.title.replace(/^תרגול: /, '')} (${KIND_LABEL[step.kind]}).`,
      href: stepHref(step, p, ctx.levelCounts), cta: '⟦המשך|המשיכי⟧',
    });
  }

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
  for (const unit of curriculumFor(p.course.route)) {
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
