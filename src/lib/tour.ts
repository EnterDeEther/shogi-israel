// The site tour: a short, opt-in walk through the home page and the menu (src/scripts/tour.ts draws it).
// It never starts by itself. Starters carry [data-tour-start]: the hero's "מה יש באתר? סיור קצר", the footer link
// "סיור באתר", the line at the end of /try/pieces/, and /?tour=site. Each step points at an element with
// data-tour="<target>"; a step whose target is not on the page (a page not live yet, accounts off, the learner
// home hiding the newcomer hero) is left out, and the counter is worked out after that.

export interface TourStep {
  /** data-tour value of the element this step highlights. */
  target: string;
  title: string;
  body: string;
  note?: string;
  link?: { href: string; label: string };
}

export interface TourCard {
  title: string;
  body: string;
  primary: string;
  secondary: string;
}

const COUNT_WORDS: Record<number, string> = { 2: 'שני', 3: 'שלושה', 4: 'ארבעה', 5: 'חמישה', 6: 'שישה' };

export const SITE_TOUR = {
  intro: {
    title: 'סיור קצר באתר',
    body: (n: number) => `${COUNT_WORDS[n] ?? n} צעדים, בערך דקה. בכל צעד נראה לכם איפה נמצא משהו, ואתם מחליטים מתי להמשיך. אפשר לצאת בכל רגע.`,
    primary: 'התחילו את הסיור',
    secondary: 'לא עכשיו',
  },
  steps: [
    {
      target: 'try',
      title: 'הצעד הראשון: צפו במשחק אחד',
      body: 'משחק שלם, מהלך אחרי מהלך, עם הסבר פשוט לכל מהלך. לא צריך לדעת כלום מראש, ולא צריך להירשם.',
      note: 'לחיצה על הכפתור המסומן תפתח את המשחק ותסגור את הסיור.',
    },
    {
      target: 'learn',
      title: 'ללמוד בקצב שלכם',
      body: 'בתפריט, תחת "למדו לשחק": חוקים בסיסיים בשיעורים קצרים, תרגול על הלוח, פתיחות ומבצרים, ובעיות מט. הכול בעברית ובחינם.',
    },
    {
      target: 'play',
      title: 'לשחק כאן, באתר',
      body: 'בתפריט, תחת "שחקו": נגד המחשב, בעשר רמות, ישר בדפדפן. וכשתרצו יריבים אמיתיים, יש מדריך לליש׳וגי, שם משחקים מול שחקנים מכל העולם.',
    },
    {
      target: 'know',
      title: 'שחקני שחמט? התחילו כאן',
      body: 'בתפריט, תחת "הכירו את השוגי": מה כבר מוכר לכם ומה חדש, ההיסטוריה של המשחק, ואיך עובדות הדרגות.',
    },
    {
      target: 'account',
      title: 'חשבון, רק אם תרצו',
      body: 'חשבון בחינם שומר את ההתקדמות בכל מכשיר ופותח את מסלול הלימוד האישי, עם נקודות ודרגות לימוד. כל השאר עובד גם בלי.',
      link: { href: '/ranks/#site', label: 'מה זו דרגת לימוד?' },
    },
    {
      target: 'community',
      title: 'קהילה קטנה ומתחילה',
      body: 'בתפריט, תחת "קהילה": קהילת הוואטסאפ והאינסטגרם של שחקני שוגי בישראל. כתבו "חדש" בקבוצה, ואענה לכם אישית.',
    },
  ] satisfies TourStep[],
  end: {
    title: 'זה הכול',
    body: 'כדי לראות את הסיור שוב, יש קישור "סיור באתר" בתחתית כל דף.',
    primary: 'צפו במשחק אחד',
    secondary: 'סגירה',
  } satisfies TourCard,
};

/** The steps whose target is on this page, in order. */
export const stepsFor = (steps: TourStep[], has: (target: string) => boolean): TourStep[] => steps.filter((s) => has(s.target));

export const counter = (n: number, total: number): string => `צעד ${n} מתוך ${total}`;

/** How the last tour on this device ended. Used only to show the "you can come back" note once. */
export type TourEnd = 'done' | 'skipped' | 'left';
export const TOUR_KEY = 'shogi-il.tour';

export function readTourEnd(store: Pick<Storage, 'getItem'> | undefined): TourEnd | null {
  try {
    const v = JSON.parse(store?.getItem(TOUR_KEY) || 'null');
    return v && ['done', 'skipped', 'left'].includes(v.site) ? v.site : null;
  } catch { return null; }
}

export function writeTourEnd(store: Pick<Storage, 'setItem'> | undefined, end: TourEnd, at = new Date()): void {
  try { store?.setItem(TOUR_KEY, JSON.stringify({ site: end, at: at.toISOString() })); } catch { /* private mode: fine */ }
}

/** The tour runs on the home page only; a starter elsewhere links here (the footer script starts it). */
export const TOUR_URL = '/?tour=site';
