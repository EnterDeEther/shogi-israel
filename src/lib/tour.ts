export interface TourStep {
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
  stay?: boolean;
}

export interface Tour {
  name: string;
  again: string;
  intro: { title: string; body: (steps: number) => string; primary: string; secondary: string };
  steps: TourStep[];
  end: TourCard;
}

const COUNT_WORDS: Record<number, string> = { 2: 'שני', 3: 'שלושה', 4: 'ארבעה', 5: 'חמישה', 6: 'שישה', 7: 'שבעה', 8: 'שמונה' };

export const SITE_TOUR: Tour = {
  name: 'סיור באתר',
  again: 'אפשר לחזור לסיור מהקישור "סיור באתר" בתחתית הדף.',
  intro: {
    title: 'סיור קצר באתר',
    body: (n: number) => `${COUNT_WORDS[n] ?? n} צעדים, בערך דקה. בכל צעד נראה לך איפה נמצא משהו, ⟦ואתה|ואת⟧ ⟦מחליט|מחליטה⟧ מתי להמשיך. אפשר לצאת בכל רגע.`,
    primary: '⟦התחל|התחילי⟧ את הסיור',
    secondary: 'לא עכשיו',
  },
  steps: [
    {
      target: 'try',
      title: 'הצעד הראשון: ⟦צפה|צפי⟧ במשחק אחד',
      body: 'משחק שלם, מהלך אחרי מהלך, עם הסבר פשוט לכל מהלך. לא צריך לדעת כלום מראש, ולא צריך להירשם.',
      note: 'לחיצה על הכפתור המסומן ⟦תפתח|תפתחי⟧ את המשחק ⟦ותסגור|ותסגרי⟧ את הסיור.',
    },
    {
      target: 'learn',
      title: 'ללמוד בקצב שלך',
      body: 'בתפריט, תחת "⟦למד|למדי⟧ לשחק": חוקים בסיסיים בשיעורים קצרים, תרגול על הלוח, פתיחות ומבצרים, ובעיות מט. הכול בעברית ובחינם.',
    },
    {
      target: 'play',
      title: 'לשחק כאן, באתר',
      body: 'בתפריט, תחת "⟦שחק|שחקי⟧": נגד המחשב, בעשר רמות, ישר בדפדפן. ⟦וכשתרצה|וכשתרצי⟧ יריבים אמיתיים, יש מדריך לליש׳וגי, שם משחקים מול שחקנים מכל העולם.',
    },
    {
      target: 'quick',
      title: 'שני קיצורי דרך, בכל דף',
      body: 'בראש העמוד: "משחק" פותח משחק נגד המחשב, וכשיש משחק פתוח הוא ממשיך אותו מאותו מהלך. "מסלול" מוביל לצעד הבא במסלול הלימוד האישי.',
    },
    {
      target: 'settings',
      title: 'הגדרות',
      body: 'מראה בהיר או כהה, סימון הכלים, גופן האותיות, צלילים ואיך לפנות אליך.',
    },
    {
      target: 'know',
      title: 'שחקני שחמט? ⟦התחל|התחילי⟧ כאן',
      body: 'בתפריט, תחת "⟦הכר|הכירי⟧ את השוגי": מה כבר מוכר לך ומה חדש, ההיסטוריה של המשחק, ואיך עובדות הדרגות.',
    },
    {
      target: 'account',
      title: 'חשבון, רק אם ⟦תרצה|תרצי⟧',
      body: 'חשבון בחינם שומר את ההתקדמות בכל מכשיר ופותח את מסלול הלימוד האישי, עם נקודות ודרגות לימוד. כל השאר עובד גם בלי.',
      link: { href: '/ranks/#site', label: 'מה זו דרגת לימוד?' },
    },
    {
      target: 'community',
      title: 'קהילה קטנה ומתחילה',
      body: 'בתפריט, תחת "קהילה": קהילת הוואטסאפ והאינסטגרם של שחקני שוגי בישראל. ⟦כתוב|כתבי⟧ "חדש" בקבוצה, ואענה לך אישית.',
    },
  ],
  end: {
    title: 'זה הכול',
    body: 'כדי לראות את הסיור שוב, יש קישור "סיור באתר" בתחתית כל דף.',
    primary: '⟦צפה|צפי⟧ במשחק אחד',
    secondary: 'סגירה',
  },
};

export const ACCOUNT_TOUR: Tour = {
  name: 'סיור בחשבון',
  again: 'אפשר לחזור לסיור מההגדרות ב"החשבון שלי".',
  intro: {
    title: 'סיור קצר בחשבון',
    body: (n: number) => `${COUNT_WORDS[n] ?? n} צעדים, פחות מדקה: מה החשבון נותן לך, ואיפה הכול נמצא. ⟦אתה|את⟧ ⟦מחליט|מחליטה⟧ מתי להמשיך, ואפשר לצאת בכל רגע.`,
    primary: '⟦התחל|התחילי⟧ את הסיור',
    secondary: 'לא עכשיו',
  },
  steps: [
    {
      target: 'next',
      title: 'הצעד הבא שלך',
      body: 'הכפתור הזה מוביל תמיד לשלב הבא במסלול הלימוד האישי שלך, בכל מכשיר ⟦שתתחבר|שתתחברי⟧ ממנו.',
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
      title: 'מייל שבועי, רק אם ⟦תרצה|תרצי⟧',
      body: 'פעם בשבוע, ביום ראשון בערב: בעיית מט אחת. ⟦הפעל|הפעילי⟧ או ⟦כבה|כבי⟧ ב"החשבון שלי", תחת התראות.',
      link: { href: '/account/#notifications', label: 'להגדרות ההתראות' },
    },
  ],
  end: {
    title: 'זהו, ⟦אתה|את⟧ ⟦מוכן|מוכנה⟧',
    body: 'אפשר לראות את הסיור הזה שוב בהגדרות, ב"החשבון שלי".',
    primary: 'לצעד הבא שלי',
    secondary: 'סגירה',
  },
};

export const APP_TOUR: Tour = {
  name: 'סיור באפליקציה',
  again: 'אפשר לחזור לסיור מההגדרות, בשורה "סיור באפליקציה".',
  intro: {
    title: '⟦ברוך הבא|ברוכה הבאה⟧ לאפליקציה',
    body: (n: number) => `${COUNT_WORDS[n] ?? n} צעדים קצרים: איפה ההגדרות, איך משתמשים בהן, ומאיפה מתחילים ללמוד או לשחק. ⟦אתה|את⟧ ⟦מחליט|מחליטה⟧ מתי להמשיך, ואפשר לצאת בכל רגע.`,
    primary: '⟦התחל|התחילי⟧ סיור קצר',
    secondary: 'לא עכשיו',
  },
  steps: [
    {
      target: 'app-course',
      title: 'המסלול שלך',
      body: 'מכאן ⟦ממשיך|ממשיכה⟧ ללמוד: לחיצה אחת פותחת את הצעד הבא במסלול הלימוד האישי. בפעם הראשונה הוא מתחיל במשחק קצר אחד לצפייה.',
    },
    {
      target: 'app-play',
      title: 'משחק נגד המחשב',
      body: 'עשר רמות, מהקלה ביותר. משחק שלא גמרת נשמר ומחכה לך כאן, ו"או משחק חדש" פותח משחק חדש.',
    },
    {
      target: 'app-settings',
      title: 'ההגדרות',
      body: 'לחיצה כאן פותחת את ההגדרות של המכשיר: מראה בהיר או כהה, סימון הכלים (עברית, אנגלית או קאנג׳י), צלילים ורטט, איך לפנות אליך, והתראות. כל שינוי נשמר מיד, ואפשר לנסות ולחזור.',
    },
    {
      target: 'settings',
      title: 'הגדרות מכל דף',
      body: 'בראש כל דף, בתפריט ☰ (במסך רחב: גלגל השיניים), "הגדרות" מחזירה לכאן. בתפריט יש גם את כל השאר: שיעורים, בעיות מט וקהילה.',
    },
    {
      target: 'quick',
      title: 'קיצורי דרך בכל דף',
      body: 'בראש כל דף: "משחק" ממשיך את המשחק נגד המחשב או פותח חדש, ו"מסלול" מוביל לצעד הבא שלך.',
    },
  ],
  end: {
    title: 'זהו, אפשר להתחיל',
    body: 'הסיור נמצא תמיד בהגדרות, בשורה "סיור באפליקציה".',
    primary: 'למסלול שלי',
    secondary: 'סגירה',
  },
};

export const PLAY_TOUR: Tour = {
  name: 'סיור בעמוד',
  again: 'אפשר לחזור לסיור מההגדרות, בשורה "סיור בעמוד".',
  intro: {
    title: 'פעם ראשונה כאן?',
    body: () => 'סיור קצר בעמוד: מה כל דבר עושה. פחות מדקה. המשחק מחכה, והשעון לא רץ.',
    primary: 'לסיור',
    secondary: 'ישר למשחק',
  },
  steps: [
    {
      target: 'play-armies',
      title: 'שני הצבאות',
      body: 'הכלים שלך למטה. הכלים של המחשב למעלה והפוכים: החוד של כל כלי מצביע לכיוון היריב.',
    },
    {
      target: 'play-hand',
      title: 'היד שלך',
      body: 'כלי שלכדת מגיע לכאן ועובר לצד שלך. לחיצה עליו ואז על משבצת פנויה: זו הצנחה, והיא המהלך שלך בתור הזה.',
    },
    {
      target: 'play-zone',
      title: 'אזור ההכתרה',
      body: 'שלוש השורות האחרונות הן אזור ההכתרה. כלי שנכנס אליהן יכול לעבור הכתרה: הוא הופך לכלי חזק יותר, ומסומן באדום.',
    },
    {
      target: 'play-tools',
      title: 'הכפתורים',
      body: 'החזרת מהלך: לקחת מהלך חזרה. הפיכת הלוח: לראות מהצד השני. כניעה: להודות בהפסד ולסיים את המשחק. משחק חדש. הגדרות: סימון הכלים, נקודות, צלילים, והסיור הזה.',
    },
    {
      target: 'play-moves',
      title: 'רשימת המהלכים',
      body: 'כל המהלכים נרשמים כאן. לחיצה על מהלך מראה את הלוח כמו שהיה אז, בלי לבטל שום דבר. KIF: רישום המשחק, להורדה או להעתקה.',
    },
    {
      target: 'play-pieces',
      title: 'סימון הכלים',
      body: 'כאן מחליפים את הסימון על הכלים: עברית, שחמט, אנגלית או קאנג׳י. המשחק עצמו לא משתנה.',
    },
  ],
  end: {
    title: 'זהו, ⟦אתה|את⟧ ⟦מוכן|מוכנה⟧',
    body: 'אפשר לפתוח את הסיור שוב מההגדרות, בשורה "סיור בעמוד".',
    primary: 'למשחק',
    secondary: 'סגירה',
    stay: true,
  },
};

export type TourId = 'site' | 'account' | 'app' | 'play';
export const TOURS: Record<TourId, Tour> = { site: SITE_TOUR, account: ACCOUNT_TOUR, app: APP_TOUR, play: PLAY_TOUR };
export const isTourId = (v: string | null | undefined): v is TourId => v === 'site' || v === 'account' || v === 'app' || v === 'play';

export const stepsFor = (steps: TourStep[], has: (target: string) => boolean): TourStep[] => steps.filter((s) => has(s.target));

export const counter = (n: number, total: number): string => `צעד ${n} מתוך ${total}`;

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
  try { store?.setItem(TOUR_KEY, JSON.stringify({ ...readAll(store), [id]: { end, at: at.toISOString() } })); } catch { }
}

export const TOUR_URL = '/?tour=site';
export const ACCOUNT_TOUR_URL = '/?tour=account';
export const APP_TOUR_URL = '/app/?tour=app';
