// The site tours: short, opt-in walks through the home page and the menu (src/scripts/tour.ts draws them).
// They never start by themselves. "site" is for anyone: starters carry [data-tour-start] (the hero's
// "מה יש באתר? סיור קצר", the footer link "סיור באתר", the line at the end of /try/pieces/) or link to /?tour=site.
// "account" is for signed-in visitors: offered once on /account/ right after the nickname is chosen, and again
// from the account settings, through /?tour=account. Each step points at an element with data-tour="<target>";
// a step whose target is not on the page (a page not live yet, accounts off, the learner home hiding the
// newcomer hero) is left out, and the counter is worked out after that.

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

export interface Tour {
  /** The label on the start card, and the place to find the tour again (in the "closed" note). */
  name: string;
  again: string;
  intro: { title: string; body: (steps: number) => string; primary: string; secondary: string };
  steps: TourStep[];
  end: TourCard;
}

const COUNT_WORDS: Record<number, string> = { 2: 'שני', 3: 'שלושה', 4: 'ארבעה', 5: 'חמישה', 6: 'שישה' };

export const SITE_TOUR: Tour = {
  name: 'סיור באתר',
  again: 'אפשר לחזור לסיור מהקישור "סיור באתר" בתחתית הדף.',
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
  ],
  end: {
    title: 'זה הכול',
    body: 'כדי לראות את הסיור שוב, יש קישור "סיור באתר" בתחתית כל דף.',
    primary: 'צפו במשחק אחד',
    secondary: 'סגירה',
  },
};

export const ACCOUNT_TOUR: Tour = {
  name: 'סיור בחשבון',
  again: 'אפשר לחזור לסיור מההגדרות ב"החשבון שלי".',
  intro: {
    title: 'סיור קצר בחשבון',
    body: (n: number) => `${COUNT_WORDS[n] ?? n} צעדים, פחות מדקה: מה החשבון נותן לכם, ואיפה הכול נמצא. אתם מחליטים מתי להמשיך, ואפשר לצאת בכל רגע.`,
    primary: 'התחילו את הסיור',
    secondary: 'לא עכשיו',
  },
  steps: [
    {
      target: 'next',
      title: 'הצעד הבא שלכם',
      body: 'הכפתור הזה מוביל תמיד לשלב הבא במסלול הלימוד האישי שלכם, בכל מכשיר שתתחברו ממנו.',
    },
    {
      target: 'rank',
      title: 'נקודות ודרגת לימוד',
      body: 'על כל שיעור, בעיה או משחק מקבלים נקודות, פעם אחת בלבד. הדרגה כאן היא דרגת לימוד באתר, לא דרגה רשמית בשוגי.',
      link: { href: '/ranks/#site', label: 'ההבדל, בדף הדרגות' },
    },
    {
      target: 'bell',
      title: 'התראות',
      body: 'בפעמון שבראש העמוד יופיעו הצעד הבא, בעיית השבוע וחדשות מהאתר. בהגדרות אפשר לכבות כל סוג.',
    },
    {
      target: 'account',
      title: 'מייל שבועי, רק אם תרצו',
      body: 'פעם בשבוע, ביום ראשון בערב: בעיית מט אחת. מפעילים או מכבים ב"החשבון שלי", תחת התראות.',
      link: { href: '/account/#notifications', label: 'להגדרות ההתראות' },
    },
  ],
  end: {
    title: 'זהו, אתם מוכנים',
    body: 'אפשר לראות את הסיור הזה שוב בהגדרות, ב"החשבון שלי".',
    primary: 'לצעד הבא שלי',
    secondary: 'סגירה',
  },
};

export type TourId = 'site' | 'account';
export const TOURS: Record<TourId, Tour> = { site: SITE_TOUR, account: ACCOUNT_TOUR };
export const isTourId = (v: string | null | undefined): v is TourId => v === 'site' || v === 'account';

/** The steps whose target is on this page, in order. */
export const stepsFor = (steps: TourStep[], has: (target: string) => boolean): TourStep[] => steps.filter((s) => has(s.target));

export const counter = (n: number, total: number): string => `צעד ${n} מתוך ${total}`;

/** How each tour last ended on this device. Used only to show the "you can come back" note once. */
export type TourEnd = 'done' | 'skipped' | 'left';
export const TOUR_KEY = 'shogi-il.tour';
const ENDS: TourEnd[] = ['done', 'skipped', 'left'];

type Saved = Partial<Record<TourId, { end: TourEnd; at: string }>>;
function readAll(store: Pick<Storage, 'getItem'> | undefined): Saved {
  try {
    const v = JSON.parse(store?.getItem(TOUR_KEY) || 'null');
    return v && typeof v === 'object' ? v : {};
  } catch { return {}; }
}

export function readTourEnd(store: Pick<Storage, 'getItem'> | undefined, id: TourId = 'site'): TourEnd | null {
  const end = readAll(store)[id]?.end;
  return end && ENDS.includes(end) ? end : null;
}

export function writeTourEnd(store: (Pick<Storage, 'getItem'> & Pick<Storage, 'setItem'>) | undefined, end: TourEnd, id: TourId = 'site', at = new Date()): void {
  try { store?.setItem(TOUR_KEY, JSON.stringify({ ...readAll(store), [id]: { end, at: at.toISOString() } })); } catch { /* private mode: fine */ }
}

/** The tours run on the home page only; a starter elsewhere links here (the footer script starts it). */
export const TOUR_URL = '/?tour=site';
export const ACCOUNT_TOUR_URL = '/?tour=account';
