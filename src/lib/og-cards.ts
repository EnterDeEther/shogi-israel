import { makeSfen } from 'shogiops/sfen';
import { categories } from '../learn/categories';
import { currentPosition } from '../learn/util';
import { stageSlug } from '../learn/urls';
import { RULES_COURSE } from './course';
import { FIRST_GAME, firstGamePlies } from './first-game';
import { LENGTH_INFO, LENGTHS } from '../tsume/puzzles';
import mate1 from '../tsume/data/mate1.json';
import mate3 from '../tsume/data/mate3.json';
import mate5 from '../tsume/data/mate5.json';
import mate7 from '../tsume/data/mate7.json';

export interface OgCard {
  path: string;
  eyebrow?: string;
  title: string;
  sub: string;
  sfen: string;
  home?: boolean;
  highlight?: string;
  zones?: boolean;
  kanji?: boolean;
}

export const ogSlug = (path: string): string => path.replace(/^\/+|\/+$/g, '').replace(/\/+/g, '-') || 'default';

const START = 'lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1';
const plain = (s: string) => s.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();

const LESSONS: Record<string, Pick<OgCard, 'sfen' | 'highlight' | 'zones' | 'kanji'>> = {
  '01-board-pieces-setup': { sfen: START },
  '02-how-pieces-move': { sfen: '9/9/9/9/4K4/9/9/9/9 b - 1', highlight: '44,54,64,45,65,46,56,66' },
  '03-promotion': { sfen: '9/9/9/4S4/9/9/9/9/9 b - 1', highlight: '43,53,63', zones: true },
  '04-drops': { sfen: '9/9/3r1b3/9/9/9/9/9/9 b N 1', highlight: '55' },
  '05-check-mate': { sfen: '4k4/9/4P4/9/9/9/9/9/9 b G 1', highlight: '52' },
  '06-illegal-moves-endings': { sfen: '4r4/9/9/9/9/9/9/4G4/4K4 b - 1', highlight: '47,67,48,68' },
  '07-reading-pieces': { sfen: '4k4/9/1r2G1b2/9/2S3s2/9/1B2g1R2/9/4K4 b - 1', kanji: true },
  '08-reading-notation': { sfen: 'lnsgkgsnl/1r5b1/pppppp1pp/6p2/9/2P6/PP1PPPPPP/1B5R1/LNSGKGSNL b - 3', highlight: '76,34' },
};
const LESSON_SUB: Record<string, string> = {
  '01-board-pieces-setup': '81 משבצות, 40 כלים בצבע אחד, ומי מתחיל. כל מה שצריך לפני המהלך הראשון.',
  '02-how-pieces-move': 'שמונה כלים, שמונה צורות תנועה: ארבעה זזים משבצת אחת, אחד קופץ, ושלושה נוסעים רחוק.',
  '03-promotion': 'כלי שמגיע לשלוש השורות האחרונות יכול להתהפך ולהתחזק. מי, מתי, ומתי עדיף לוותר.',
  '04-drops': 'הכלל שהופך שוגי לשוגי: כלי שלכדת עובר אליך, ואפשר להחזיר אותו ללוח כמעט בכל מקום.',
  '05-check-mate': 'איך מנצחים: שח, שלוש דרכים לצאת ממנו, מט, ומט שאסור לעשות בהצנחת רגלי.',
  '06-illegal-moves-endings': 'מהלך לא חוקי מפסיד במקום. ועוד: כניעה, חזרה מרובעת, מלך חודר ושעון.',
  '07-reading-pieces': 'על כלים אמיתיים יש קאנג׳י. 14 סימנים, ⟦ואתה|ואת⟧ ⟦קורא|קוראת⟧ כל לוח שוגי בעולם.',
  '08-reading-notation': 'P-76, Bx22+, ▲7六歩: איך כותבים מהלכים, כדי לקרוא ספרים, בעיות ומשחקים.',
};

const LINE_CATEGORIES = new Set(['openings', 'castles', 'strategy']);

function stageSfen(categoryKey: string, levels: (typeof categories)[number]['stages'][number]['levels']): string {
  if (!LINE_CATEGORIES.has(categoryKey)) return makeSfen(currentPosition(levels[0]));
  const last = levels[levels.length - 1];
  const moves = last.scenario ?? (last.line ?? []).map((usi) => ({ usi, color: 'sente' as const }));
  return makeSfen(currentPosition(last, moves));
}

const PUZZLES: Record<number, [string, string][]> = { 1: mate1, 3: mate3, 5: mate5, 7: mate7 } as Record<number, [string, string][]>;
const tsumeSfen = (n: number) => {
  const list = PUZZLES[n];
  const busy = list.slice(0, 60).find(([sfen]) => (sfen.split(' ')[0].match(/[a-zA-Z]/g) ?? []).length >= 7);
  return (busy ?? list[0])[0];
};

export function ogCards(): OgCard[] {
  const cards: OgCard[] = [];
  const stages = categories.flatMap((c) => c.stages);

  cards.push({
    path: '/', title: 'שוגי ישראל', home: true,
    sub: 'השחמט היפני, בעברית ומאפס. קורס חוקים חינמי וקהילה ישראלית.', sfen: START,
  });

  cards.push({
    path: '/rules/', eyebrow: 'קורס חינמי בעברית', title: 'חוקים בסיסיים',
    sub: `${RULES_COURSE.length} שיעורים קצרים ואינטראקטיביים, מהלוח הריק ועד מט. בלי הרשמה.`, sfen: START,
  });
  for (const l of RULES_COURSE) {
    cards.push({
      path: `/rules/${l.slug}/`, eyebrow: `חוקים בסיסיים · שיעור ${l.n} מתוך ${RULES_COURSE.length}`, title: l.title,
      sub: LESSON_SUB[l.slug], ...LESSONS[l.slug],
    });
  }

  const castles = categories.find((c) => c.key === 'castles')!;
  cards.push({
    path: '/learn/', eyebrow: 'לומדים תוך כדי משחק', title: 'שיעורים אינטראקטיביים',
    sub: `${stages.length} תרגילים קצרים על הלוח: הכלים, יסודות, פתיחות, מבצרים ואסטרטגיה.`,
    sfen: stageSfen('strategy', categories.find((c) => c.key === 'strategy')!.stages[0].levels),
  });
  cards.push({
    path: '/learn/guide/', eyebrow: 'פתיחה · אמצע המשחק · סוף המשחק', title: 'פתיחות, מבצרים ואסטרטגיה',
    sub: 'איך משחק שוגי בנוי מההתחלה ועד ההתקפה, ומה כל שלב צריך.',
    sfen: stageSfen('castles', castles.stages[castles.stages.length - 1].levels),
  });
  for (const c of categories) {
    for (const s of c.stages) {
      cards.push({
        path: `/learn/${stageSlug(s.key)}/`, eyebrow: `שיעור אינטראקטיבי · ${c.name}`,
        title: plain(s.title), sub: plain(s.subtitle), sfen: stageSfen(c.key, s.levels),
      });
    }
  }

  const total = LENGTHS.reduce((sum, n) => sum + PUZZLES[n].length, 0);
  cards.push({
    path: '/tsume/', eyebrow: 'צומה', title: 'בעיות מט',
    sub: `${total.toLocaleString('he-IL')} בעיות, ממהלך אחד ועד 7. ⟦אתה|את⟧ ⟦פותר|פותרת⟧ על הלוח, עם משוב אחרי כל מהלך.`, sfen: tsumeSfen(3),
  });
  for (const n of LENGTHS) {
    cards.push({
      path: `/tsume/${n}/`, eyebrow: `בעיות מט · ${PUZZLES[n].length.toLocaleString('he-IL')} בעיות`,
      title: LENGTH_INFO[n].title, sub: `${LENGTH_INFO[n].sub} פותרים על הלוח, עם רמז ופתרון מלא.`, sfen: tsumeSfen(n),
    });
  }

  cards.push(
    {
      path: '/try/', eyebrow: 'משחק אחד · מהלך אחרי מהלך', title: 'איך נראה משחק שוגי?',
      sub: `משחק שלם ב־${FIRST_GAME.length} מהלכים, מהפתיחה ועד המט. ⟦לחץ|לחצי⟧ על כל מהלך ⟦וקבל|וקבלי⟧ הסבר פשוט. בלי הרשמה.`,
      sfen: firstGamePlies().at(-2)!.sfen,
    },
    {
      path: '/try/pieces/', eyebrow: 'שלוש דקות · שלושה כלים', title: 'עכשיו ⟦תנסה|תנסי⟧ בעצמך',
      sub: 'צריח, רץ ורגלי: לכידה אחת עם כל כלי. בשוגי כלי שלכדת לא נעלם, הוא נשאר ביד שלך.',
      sfen: '9/4p4/9/9/9/9/4R4/9/9 b - 1', highlight: '52',
    },
    {
      path: '/play/', eyebrow: '⟦שחק|שחקי⟧ עכשיו', title: 'משחק נגד המחשב',
      sub: 'עשר רמות, מהצעד הראשון ועד מנוע חזק. החזרת מהלך, שעון, ובלי הרשמה.', sfen: START,
    },
    {
      path: '/course/', eyebrow: 'מאיפה מתחילים?', title: 'מסלול לימוד אישי',
      sub: '⟦ענה|עני⟧ על שאלה אחת ⟦וקבל|וקבלי⟧ את הצעד הבא: מהחוקים, דרך פתיחה ואמצע המשחק, ועד בעיות מט.',
      sfen: stageSfen('openings', categories.find((c) => c.key === 'openings')!.stages[1].levels),
    },
    {
      path: '/what-is-shogi/', eyebrow: 'השחמט היפני', title: 'מה זה שוגי?',
      sub: 'לוח 9 על 9, 20 כלים לכל צד, וכלי שלכדת עובר לצד שלך. התשובות הקצרות, בעברית.', sfen: START,
    },
    {
      path: '/chess/', eyebrow: 'לשחקני שחמט', title: 'יודע שחמט? חצי מהשוגי כבר אצלך',
      sub: 'מה מוכר, מה שונה, ואיך מגיעים למשחק ראשון תוך שעה, ישר מהטלפון.', sfen: START,
    },
    {
      path: '/history/', eyebrow: 'מאות שנים על לוח אחד', title: 'ההיסטוריה של השוגי',
      sub: 'ממשחק הודי עתיק, דרך אלופי השוגון, ועד המחשב שניצח את המייג׳ין.', sfen: START,
    },
    {
      path: '/ranks/', eyebrow: 'קיו ודאן', title: 'דרגות בשוגי',
      sub: 'איך עובדות דרגות בעולם, איך משיגים דרגה אמיתית, ומה הדרגה שלך במסלול הלימוד.', sfen: START,
    },
    {
      path: '/clock/', eyebrow: 'שעון בשוגי', title: 'איך משחק על זמן עובד?',
      sub: 'זמן ראשי, ספירת שניות, תוספת זמן וזמן קבוע, ואיך משחקים המקצוענים.',
      sfen: 'lnsgkgsnl/1r5b1/pppppp1pp/6p2/9/2P6/PP1PPPPPP/1B5R1/LNSGKGSNL b - 3',
    },
    {
      path: '/kif/', eyebrow: 'רישום משחק', title: 'קובצי KIF',
      sub: 'מה זה קובץ KIF, איך קוראים אותו, ואיפה משתמשים בו. עם צופה שעובד בדפדפן.',
      sfen: 'lnsgkgsnl/1r5+B1/pppppp1pp/6p2/9/2P6/PP1PPPPPP/7R1/LNSGKGSNL w B 4',
    },
    {
      path: '/tsume/week/', eyebrow: 'בעיה אחת בשבוע', title: 'בעיית השבוע',
      sub: 'בעיית מט אחת בכל שבוע, אותה בעיה לכולם. פותרים על הלוח, בעברית ובחינם.', sfen: tsumeSfen(1),
    },
    {
      path: '/community/', eyebrow: 'שחקני שוגי בישראל', title: 'הקהילה',
      sub: 'קהילת הוואטסאפ, האינסטגרם, הפייסבוק, והקבוצה והליגה הישראלית בליש׳וגי.', sfen: START,
    },
    {
      path: '/app/', eyebrow: 'במסך הבית של הטלפון', title: 'שוגי ישראל כאפליקציה',
      sub: 'משחק נגד המחשב, המסלול האישי וההגדרות, בלחיצה אחת. בלי חנות אפליקציות.', sfen: START,
    },
    {
      path: '/about/', eyebrow: 'מי אנחנו', title: 'אודות שוגי ישראל',
      sub: 'למה בנינו את האתר, מי עזר לנו בדרך, ואיך יוצרים קשר.', sfen: START,
    },
    {
      path: '/lishogi/', eyebrow: 'שוגי אונליין', title: 'המדריך לליש׳וגי',
      sub: 'פתיחת חשבון, משחק עם חברים, הקבוצה והליגה הישראלית, טורנירים ודירוג.', sfen: START,
    },
  );
  return cards;
}
