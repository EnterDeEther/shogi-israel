import { curriculumFor, isOptional, nextStep, stepState, stepsFor } from './curriculum';
import type { SyncedProgress } from './progress-sync';
import type { IconName } from './icons';

export interface AfterItem { key: string; icon: IconName; title: string; text: string; href: string; cta: string; external?: boolean; touch?: boolean }

export const AFTER_COURSE: AfterItem[] = [
  { key: 'play', icon: 'cpu', title: 'המחשב, מרמה 5 והלאה', text: 'עשר רמות. כל רמה חדשה שמנצחים מוסיפה נקודות לדרגה.', href: '/play/?level=5', cta: 'לשחק' },
  { key: 'friend', icon: 'two-players', title: '⟦שחק|שחקי⟧ עם חבר', text: 'שני שחקנים על אותו מכשיר, כל אחד מקבל צד של הלוח.', href: '/play/?vs=local', cta: 'לשחק ביחד', touch: true },
  { key: 'tsume', icon: 'king', title: 'בעיות מט ב־7 מהלכים', text: 'הבעיות הארוכות באתר, לשחקנים עם ניסיון.', href: '/tsume/7/', cta: 'לפתור' },
  { key: 'online', icon: 'online', title: 'יריבים מכל העולם', text: 'בלישוגי, אתר השוגי הבינלאומי, יש יריבים בכל שעה.', href: '/lishogi/', cta: 'ללישוגי' },
];

export const nextLevel = (won: number): number => Math.min(10, Math.max(5, won + 1));

export function finishedCourse(p: SyncedProgress, levelCounts: Record<string, number>): boolean {
  if (nextStep(p, levelCounts)) return false;
  const req = curriculumFor(p.course.route).flatMap((u) => stepsFor(u, p.course)).filter((s) => !isOptional(s, p.course));
  const done = req.filter((s) => stepState(s, p, levelCounts) === 'done').length;
  return req.length > 0 && done * 2 >= req.length;
}

export const GRADUATED_KEY = 'shogi-il.course.graduated';
