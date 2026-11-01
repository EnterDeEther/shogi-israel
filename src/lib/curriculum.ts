import { stageUrl } from '../learn/urls.js';
import type { CourseLevel, CourseState, Route, SyncedProgress } from './progress-sync';

export type StepKind = 'try' | 'rules' | 'learn' | 'read' | 'tsume' | 'play';

export interface Step {
  id: string;
  kind: StepKind;
  title: string;
  why: string;
  minutes: number;
  rules?: string;
  learn?: string[];
  href?: string;
  tsume?: 1 | 3 | 5 | 7;
  target?: number;
  play?: number;
  win?: boolean;
  only?: Route[];
  optional?: Route[];
  known?: Route[];
}

export interface Unit {
  key: string;
  level: CourseLevel;
  title: string;
  why: string;
  steps: Step[];
}

export const LEVEL_INFO: Record<CourseLevel, { title: string; goal: string; why: string }> = {
  beginner: {
    title: 'מתחילים',
    goal: 'לדעת לשחק',
    why: 'מאפס: הלוח, כל כלי בנפרד, ואז לכידה, הצנחה, שח ומט. לא צריך לדעת שום דבר מראש, גם לא שחמט.',
  },
  intermediate: {
    title: 'בינוניים',
    goal: 'לשחק עם תוכנית',
    why: 'מסדרים את הלוח, צופים במשחק שלם ומשחקים את הראשון, ואז פתיחות ומבצרים: איך מתארגנים לפני הקרב.',
  },
  advanced: {
    title: 'מתקדמים',
    goal: 'לבחור סגנון ולהכריע',
    why: 'ערך הכלים, תוכניות התקפה באמצע המשחק, ובעיות מט שמאמנות את סוף המשחק.',
  },
};

export const ROUTE_INFO: Record<Route, { label: string; sub: string }> = {
  main: { label: 'המסלול הרגיל', sub: 'כל כלי וכל כלל מוסבר מההתחלה' },
  chess: { label: 'מסלול לשחקני שחמט', sub: 'מסלול נפרד, רק עם מה שחדש לשחקן שחמט, וכל הסבר משווה לשחמט' },
};

const ALL: Route[] = ['main', 'chess'];
const CHESS: Route[] = ['chess'];

const stage = (key: string, title: string, why: string, minutes: number, extra: Partial<Step> = {}): Step =>
  ({ id: `learn-${key}`, kind: 'learn', learn: [key], title, why, minutes, ...extra });
const rules = (n: string, slug: string, title: string, why: string, minutes = 10): Step =>
  ({ id: `rules-${n}`, kind: 'rules', rules: slug, title, why, minutes, optional: ALL });

export const CURRICULUM: Unit[] = [
  {
    key: 'theIntroduction', level: 'beginner', title: 'מבוא',
    why: 'איך נראה הלוח, איך מזיזים כלי באתר, ומי מתחיל.',
    steps: [
      stage('introduction', 'מבוא: הלוח והמהלך הראשון', 'לפני כל כלי: איך עושים מהלך על הלוח, ומי משחק ראשון.', 3),
      rules('01', '01-board-pieces-setup', 'לקריאה: הלוח, הכלים והעמדה הפותחת', 'אותו חומר בשיעור כתוב, עם שאלות.'),
    ],
  },
  {
    key: 'shogiPieces', level: 'beginner', title: 'כלי השוגי',
    why: 'שמונה סוגי כלים, וכל אחד מקבל שלב משלו: קודם איך הוא זז, ורק אחר כך משתמשים בו.',
    steps: [
      { id: 'try-pieces', kind: 'try', href: '/try/pieces/', title: 'טעימה: שלוש דקות, שלושה כלים', why: 'צריח, רץ ורגלי בתרגיל קצר, למי שהגיע מדף הבית.', minutes: 3, optional: ALL },
      stage('king', 'המלך', 'הכלי שעליו נלחמים.', 3),
      stage('gold', 'גנרל זהב', 'שומר הראש של המלך.', 5),
      stage('silver', 'גנרל כסף', 'הגנרל השני, שזז אחרת.', 6),
      stage('knight', 'פרש', 'קופץ, אבל רק קדימה.', 4),
      stage('lance', 'רומח', 'נוסע ישר קדימה, בלי דרך חזרה.', 4),
      stage('bishop', 'רץ', 'נע באלכסון למרחק.', 5),
      stage('rook', 'צריח', 'הכלי החזק במשחק.', 5),
      stage('pawn', 'רגלי', 'הקטן ביותר, ויש לכל צד תשעה.', 4),
      rules('02', '02-how-pieces-move', 'לקריאה: איך כל כלי זז', 'כל שמונת הכלים בשיעור אחד, עם הסבר למה כל אחד בנוי כך.', 15),
      rules('03', '03-promotion', 'לקריאה: הכתרה', 'למה כמעט כל כלי מתחזק כשהוא נכנס לשטח של היריב.'),
    ],
  },
  {
    key: 'fundamentals', level: 'beginner', title: 'יסודות',
    why: 'עכשיו הכלים נפגשים: לוכדים, מחזירים כלים ללוח, שומרים על הכלים שלך, ובסוף מט.',
    steps: [
      stage('capture', 'לכידה', 'לוכדים כלים של היריב.', 8),
      stage('drop', 'הצנחה', 'כלי שלכדת חוזר ללוח, לצד שלך.', 10),
      stage('protection', 'הגנה', 'שומרים על הכלים שלך.', 12),
      rules('04', '04-drops', 'לקריאה: לכידה והצנחה', 'הכלל שהופך את השוגי לשוגי, עם החוקים של ההצנחה.'),
      stage('check1', 'שח', 'מתקיפים את המלך של היריב.', 6),
      stage('outOfCheck', 'יציאה משח', 'שלוש דרכים להציל את המלך שלך.', 10),
      stage('checkmate1', 'מט במהלך אחד', 'כך מנצחים.', 15),
      rules('05', '05-check-mate', 'לקריאה: שח ומט', 'מה שונה כשאפשר להצניח כלי ליד המלך.'),
    ],
  },
  {
    key: 'intermediate', level: 'intermediate', title: 'שלב ביניים',
    why: 'כל מה שצריך למשחק אמיתי: איך מסדרים את הלוח, מתי משחק נגמר בתיקו, משחק שלם לצפייה, ומשחק ראשון משלך.',
    steps: [
      stage('setup', 'סידור הלוח', 'איך מעמידים את הכלים לפני משחק, בסדר המסורתי.', 8),
      stage('repetition', 'חזרה על עמדה', 'מתי חזרה על עמדה היא תיקו, ומתי היא הפסד.', 5),
      rules('06', '06-illegal-moves-endings', 'לקריאה: מהלכים לא חוקיים ואיך משחק נגמר', 'מהלך לא חוקי מפסיד במקום. ועוד: כניעה, ומלך שחודר לשטח היריב.'),
      { id: 'try-game', kind: 'try', href: '/try/', title: '⟦צפה|צפי⟧ במשחק שלם', why: 'משחק אחד, מהלך אחרי מהלך: פתיחה, אמצע המשחק וסוף המשחק, עם הסבר לכל מהלך.', minutes: 10 },
      { id: 'play-first', kind: 'play', play: 1, title: 'משחק ראשון נגד המחשב', why: 'רמה 1 סלחנית. המטרה רק לסיים משחק שלם, לא לנצח.', minutes: 15 },
      rules('07', '07-reading-pieces', 'לקריאה: לקרוא כלים אמיתיים', 'על כלים אמיתיים כתוב קאנג׳י. 14 סימנים, ⟦ואתה|ואת⟧ ⟦קורא|קוראת⟧ כל לוח בעולם.'),
      rules('08', '08-reading-notation', 'לקריאה: רישום משחק', 'איך כותבים מהלכים, כדי לקרוא ספרים, בעיות ומשחקים מוקלטים.'),
    ],
  },
  {
    key: 'openings', level: 'intermediate', title: 'פתיחות',
    why: 'משחררים את הצריח והרץ ובוחרים מאיזה צד תוקפים. שתי משפחות, ופתיחה אחת מכל משפחה.',
    steps: [
      { id: 'read-opening', kind: 'read', href: '/learn/guide/#opening', title: 'מה זו פתיחה, ולמה צריך אותה', why: 'ארבעה דברים שפתיחה טובה עושה, ושתי משפחות הפתיחות.', minutes: 5 },
      stage('staticRook', 'צריח קבוע', 'המשפחה שבה הצריח נשאר במקומו ותוקף משם.', 5),
      stage('rangingRook', 'צריח נודד', 'המשפחה שבה הצריח עובר לצד השני.', 5),
      stage('fourthFileRook', 'פתיחה ראשונה: צריח בטור 6', 'פתיחה בטוחה ופשוטה לצריח נודד.', 10),
      stage('yagura', 'פתיחה שנייה: יגורה', 'פתיחה מהמשפחה השנייה, וכך ⟦תבין|תביני⟧ גם מה היריב מתכנן נגדך.', 10),
      stage('centralRook', 'צריח מרכזי', 'עוד דרך לצריח נודד, עם התקפה ישירה במרכז.', 8, { optional: ALL }),
      { id: 'learn-more-openings', kind: 'learn', learn: ['thirdFileRook', 'bishopExchange', 'ishida', 'quickIshida', 'opposingRook', 'doubleRangingRook', 'sidePawn', 'twistingRook'], title: 'עוד פתיחות', why: 'אישידה, חילוף רצים, צריח מתפתל ועוד. ⟦כשתרצה|כשתרצי⟧ גיוון.', minutes: 45, optional: ALL },
    ],
  },
  {
    key: 'castles', level: 'intermediate', title: 'מבצרים',
    why: 'אין הצרחה בשוגי: בונים למלך חומה של גנרלים, ובוחרים אותה לפי הפתיחה.',
    steps: [
      { id: 'read-castle', kind: 'read', href: '/learn/guide/#castle', title: 'מבצר: למה המלך צריך חומה', why: 'איך בוחרים מבצר שמתאים לפתיחה.', minutes: 5 },
      stage('rangingCastles', 'מבצרים לצריח נודד', 'מינו ומשפחתו, לפתיחה הראשונה שלך.', 10),
      stage('staticCastles', 'מבצרים לצריח קבוע', 'יגורה ועוד, לפתיחה השנייה.', 10),
      { id: 'play-opening', kind: 'play', play: 2, title: 'משחק: קודם מבצר, אחר כך התקפה', why: '⟦שחק|שחקי⟧ נגד רמה 2 או יותר, ⟦ונסה|ונסי⟧ לסיים מבצר לפני ההתקפה הראשונה.', minutes: 20 },
    ],
  },
  {
    key: 'advanced', level: 'advanced', title: 'שלב מתקדם',
    why: 'כמה שווה כל כלי, ומתי כדאי לוותר על כלי כדי להגיע למלך.',
    steps: [
      stage('value', 'ערך הכלים', 'מתי חילוף משתלם, כשכל כלי שנלכד חוזר כהצנחה.', 15),
    ],
  },
  {
    key: 'strategy', level: 'advanced', title: 'אסטרטגיה',
    why: 'אמצע המשחק: שני הצדדים מוכנים, ותוקפים לפי תוכנית.',
    steps: [
      { id: 'read-strategy', kind: 'read', href: '/learn/guide/#strategy', title: 'אסטרטגיה: איך בונים התקפה', why: 'התקפה מהירה או משחק איטי, ורעיונות שחוזרים בכל תוכנית.', minutes: 5 },
      stage('primitiveClimbingSilver', 'כסף מטפס בסיסי', 'התוכנית הראשונה של צריח קבוע: שני תוקפים מול מגן אחד.', 8),
      stage('climbingSilverVsRanging', 'כסף מטפס נגד צריח נודד', 'אותה תוכנית, נגד היריב מהמשפחה השנייה.', 8),
      stage('sittingSilver', 'כסף יושב', 'תוכנית איטית ובטוחה יותר.', 10),
      stage('whatIf', 'מה אם היריב טועה?', 'טעויות נפוצות של היריב, ואיך מענישים אותן.', 10),
      { id: 'learn-more-plans', kind: 'learn', learn: ['chainedSilver', 'bishopClimbingSilver', 'rapidSilver', 'bishopSittingSilver', 'spearingSparrow'], title: 'עוד תוכניות התקפה', why: 'כסף מהיר, שיפוד הדרור ועוד, למי שרוצה להעמיק.', minutes: 30, optional: ALL },
      { id: 'play-middle', kind: 'play', play: 3, title: 'משחק: ⟦תקוף|תקפי⟧ לפי תוכנית', why: '⟦שחק|שחקי⟧ נגד רמה 3 או יותר, ⟦ובחר|ובחרי⟧ תוכנית לפני ⟦שאתה|שאת⟧ ⟦תוקף|תוקפת⟧.', minutes: 25 },
    ],
  },
  {
    key: 'tsume', level: 'advanced', title: 'בעיות מט',
    why: 'סוף המשחק הוא מירוץ למט, ובעיות מט הן האימון הישיר.',
    steps: [
      { id: 'read-endgame', kind: 'read', href: '/learn/guide/#endgame', title: 'סוף המשחק: מירוץ למט', why: 'למה בסוף המשחק אפשר לוותר על כלים כדי להגיע למט מהר יותר.', minutes: 3 },
      { id: 'tsume-1', kind: 'tsume', tsume: 1, target: 20, title: 'בעיות מט במהלך אחד', why: '⟦פתור|פתרי⟧ 20, עד ⟦שאתה|שאת⟧ רואה מט במבט אחד.', minutes: 20 },
      { id: 'tsume-3', kind: 'tsume', tsume: 3, target: 10, title: 'בעיות מט ב־3 מהלכים', why: '⟦פתור|פתרי⟧ 10: שח, תשובה של המגן, ומט.', minutes: 25 },
      { id: 'tsume-5', kind: 'tsume', tsume: 5, target: 5, title: 'בעיות מט ב־5 מהלכים', why: '⟦פתור|פתרי⟧ 5. כאן מתחילות ההקרבות.', minutes: 25 },
      { id: 'play-win', kind: 'play', play: 4, win: true, title: '⟦נצח|נצחי⟧ את המחשב ברמה 4', why: 'כל המסלול במשחק אחד: פתיחה, תוכנית, ומירוץ למט.', minutes: 30 },
      { id: 'tsume-7', kind: 'tsume', tsume: 7, target: 3, title: 'בעיות מט ב־7 מהלכים', why: 'לשחקנים עם ניסיון: ⟦פתור|פתרי⟧ 3.', minutes: 30, optional: ALL },
    ],
  },
];

const main = (id: string, extra: Partial<Step> = {}): Step => ({ ...CURRICULUM.flatMap((u) => u.steps).find((s) => s.id === id)!, ...extra });

export const CHESS_LEVEL_INFO: Record<CourseLevel, { title: string; goal: string; why: string }> = {
  beginner: {
    title: 'מתחילים',
    goal: 'לעבור משחמט לשוגי',
    why: 'רק מה שחדש לך. המלך, הרץ והצריח זזים כמו בשחמט, אז הם חזרה מהירה. חמשת הכלים האחרים חדשים, ואחריהם הכלל שאין בשחמט, מט, וכמה שווה כל כלי.',
  },
  intermediate: {
    title: 'בינוניים',
    goal: 'משחק אמיתי, עם תוכנית',
    why: 'סידור הלוח והחוקים שאין בשחמט, משחק ראשון ברמה שמענישה טעויות, ואז פתיחות ומבצר למלך במקום הצרחה.',
  },
  advanced: {
    title: 'מתקדמים',
    goal: 'לתקוף לפי תוכנית ולהכריע',
    why: 'תוכניות התקפה באמצע המשחק, ובעיות מט: הטקטיקה של השוגי, שבה כל מהלך של התוקף הוא שח.',
  },
};

export const CHESS_CURRICULUM: Unit[] = [
  {
    key: 'chessStart', level: 'beginner', title: 'מה שונה מהשחמט',
    why: 'לוח של 9 על 9, כלים באותו צבע לשני הצדדים, וכלי שנלכד לא יוצא מהמשחק.',
    steps: [
      { id: 'read-chess-diff', kind: 'read', href: '/chess/#differences', title: 'ארבעת ההבדלים הגדולים מהשחמט', why: 'מה זהה, מה דומה ומה חדש, בארבע דקות קריאה.', minutes: 4 },
      main('learn-introduction', { title: 'הלוח והמהלך הראשון', why: 'איך עושים מהלך באתר, ואיך מזהים את הכלים של היריב כשהכול באותו צבע.' }),
    ],
  },
  {
    key: 'chessPieces', level: 'beginner', title: 'כלים מוכרים, כלים חדשים',
    why: 'שלושה כלים זזים כמו בשחמט, וחמישה חדשים לגמרי. גם הפרש והרגלי שונים ממה ⟦שאתה|שאת⟧ ⟦מכיר|מכירה⟧.',
    steps: [
      main('learn-king', { title: 'המלך: חזרה מהירה', why: 'זז כמו בשחמט. ההבדל: אין הצרחה.', known: CHESS }),
      main('learn-bishop', { title: 'הרץ: חזרה מהירה', why: 'זז כמו בשחמט, ומתחזק כשהוא נכנס לשטח של היריב.', known: CHESS }),
      main('learn-rook', { title: 'הצריח: חזרה מהירה', why: 'זז כמו בשחמט. בלי מלכה, הוא הכלי החזק במשחק.', known: CHESS }),
      main('learn-gold', { title: 'גנרל זהב', why: 'אין לו מקביל בשחמט: שומר הראש של המלך.' }),
      main('learn-silver', { title: 'גנרל כסף', why: 'דומה לזהב, אבל זז אחרת, וזה כל ההבדל.' }),
      main('learn-knight', { title: 'פרש', why: 'לא הפרש מהשחמט: קופץ רק קדימה, לשתי משבצות בלבד.' }),
      main('learn-lance', { title: 'רומח', why: 'כמו צריח שנוסע רק קדימה.' }),
      main('learn-pawn', { title: 'רגלי', why: 'לוכד ישר קדימה, לא באלכסון.' }),
      main('rules-03', { why: 'בשחמט רק רגלי מוכתר. כאן כמעט כל כלי, כשהוא נכנס לשטח של היריב.' }),
    ],
  },
  {
    key: 'chessDrops', level: 'beginner', title: 'הכלל שאין בשחמט',
    why: 'כלי שלכדת עובר לצד שלך, ואפשר להחזיר אותו ללוח כמעט לכל משבצת. זה מה שהופך את השוגי לשוגי.',
    steps: [
      main('learn-capture', { why: 'כמו בשחמט, עם הבדל אחד: הכלי שלכדת לא יוצא מהמשחק.' }),
      main('learn-drop', { why: 'כמו בקרייזיהאוס: כלי שלכדת חוזר ללוח, לצד שלך.' }),
      main('learn-protection', { why: 'כלי לא מוגן הוא מתנה כפולה: היריב לוכד אותו, ואחר כך מצניח אותו נגדך.' }),
      main('rules-04', { why: 'כל חוקי ההצנחה במקום אחד, כולל שניים שאין להם מקבילה בשחמט.' }),
    ],
  },
  {
    key: 'chessMate', level: 'beginner', title: 'שח ומט, עם הצנחות',
    why: 'שח ומט כמו בשחמט, אבל כלי שמוצנח צמוד למלך משנה את התמונה.',
    steps: [
      main('learn-check1', { why: 'שח ⟦אתה|את⟧ כבר ⟦מכיר|מכירה⟧. החדש: לתת שח בהצנחה.' }),
      main('learn-outOfCheck', { why: 'הדרכים מהשחמט, ועוד אחת: להצניח כלי שחוסם את השח.' }),
      main('learn-checkmate1', { why: 'רוב המטים בשוגי נגמרים בהצנחה. כאן ⟦תראה|תראי⟧ למה.' }),
      main('rules-05'),
    ],
  },
  {
    key: 'chessValue', level: 'beginner', title: 'כמה שווה כל כלי',
    why: 'הערכים מהשחמט לא עובדים כאן: כלי שלכדת עובר אליך, וחילוף נמדד גם במה שנתת ליריב ביד.',
    steps: [
      main('learn-value', { why: 'השלב הכי חשוב לשחקן שחמט: מתי חילוף משתלם, ולמה לא מחליפים כדי להרגיע את העמדה.' }),
      { id: 'read-chess-traps', kind: 'read', href: '/chess/#traps', title: 'חמש טעויות של שחקני שחמט', why: 'הרגלים מהשחמט שעולים כאן ביוקר, ואיך להימנע מהם.', minutes: 3 },
    ],
  },
  {
    key: 'chessGame', level: 'intermediate', title: 'לפני משחק ראשון',
    why: 'עוד כמה דברים שעובדים אחרת: איך מסדרים את הלוח, מתי חזרה על עמדה מפסידה, ומהלכים שאסורים רק בשוגי. ואז משחק.',
    steps: [
      main('learn-setup', { why: 'שורה של רגלים מלאה, ושני הצדדים זהים. וגם הסדר המסורתי.' }),
      main('learn-repetition', { why: 'בשחמט חזרה על עמדה היא תיקו. כאן היא לפעמים הפסד.' }),
      main('rules-06', { why: 'מהלך לא חוקי מפסיד במקום, ויש מהלכים שמותרים בשחמט ואסורים כאן.' }),
      main('try-game', { optional: CHESS }),
      { id: 'play-first-chess', kind: 'play', play: 3, title: 'משחק ראשון נגד המחשב, ברמה 3', why: 'רמה שמענישה טעויות, אבל אפשר לנצח בה. ניצחת? ⟦עלה|עלי⟧ רמה.', minutes: 20 },
      main('rules-07'),
      main('rules-08', { why: 'כמו רישום שחמט, עם טור ושורה במספרים. כדי לקרוא ספרים, בעיות ומשחקים מוקלטים.' }),
    ],
  },
  {
    key: 'chessOpenings', level: 'intermediate', title: 'פתיחות',
    why: 'בשחמט נלחמים על המרכז. בשוגי מחליטים קודם מאיפה הצריח יתקוף: שתי משפחות, ופתיחה אחת מכל משפחה, עם הערה לשחקני שחמט.',
    steps: ['read-opening', 'learn-staticRook', 'learn-rangingRook', 'learn-fourthFileRook', 'learn-yagura', 'learn-centralRook', 'learn-more-openings'].map((id) => main(id)),
  },
  {
    key: 'chessCastles', level: 'intermediate', title: 'מבצרים במקום הצרחה',
    why: 'אין הצרחה: בונים למלך מבצר מגנרלים, בכמה מהלכים, ובוחרים אותו לפי הפתיחה.',
    steps: ['read-castle', 'learn-rangingCastles', 'learn-staticCastles', 'play-opening'].map((id) => main(id)),
  },
  {
    key: 'chessStrategy', level: 'advanced', title: 'אסטרטגיה',
    why: 'אמצע המשחק: שני הצדדים מוכנים, ותוקפים לפי תוכנית. כל חילוף ממלא את היד, אז ההתקפה מתחממת מהר יותר מבשחמט.',
    steps: ['read-strategy', 'learn-primitiveClimbingSilver', 'learn-climbingSilverVsRanging', 'learn-sittingSilver', 'learn-whatIf', 'learn-more-plans', 'play-middle'].map((id) => main(id)),
  },
  {
    key: 'chessTsume', level: 'advanced', title: 'בעיות מט',
    why: 'כמו תרגילי טקטיקה בשחמט, רק שכל מהלך של התוקף הוא שח. סוף המשחק כאן הוא מירוץ למט, ובעיות מט הן האימון הישיר.',
    steps: ['read-endgame', 'tsume-1', 'tsume-3', 'tsume-5', 'play-win', 'tsume-7'].map((id) => main(id)),
  },
];

export const curriculumFor = (route: Route | null | undefined): Unit[] => (route === 'chess' ? CHESS_CURRICULUM : CURRICULUM);
export const levelInfoFor = (route: Route | null | undefined) => (route === 'chess' ? CHESS_LEVEL_INFO : LEVEL_INFO);

export const ALL_STEPS: Step[] = [...CURRICULUM, ...CHESS_CURRICULUM].flatMap((u) => u.steps)
  .filter((s, i, all) => all.findIndex((x) => x.id === s.id) === i);
export const LEVELS: CourseLevel[] = ['beginner', 'intermediate', 'advanced'];
export const unitsOf = (level: CourseLevel, route?: Route | null): Unit[] => curriculumFor(route).filter((u) => u.level === level);

export type Place = Pick<CourseState, 'route' | 'start'> | null;
const routeOf = (place: Place): Route => place?.route ?? 'main';
const unitOf = (s: Step, place: Place): Unit =>
  (curriculumFor(routeOf(place)).find((u) => u.steps.some((x) => x.id === s.id)) ?? [...CURRICULUM, ...CHESS_CURRICULUM].find((u) => u.steps.some((x) => x.id === s.id)))!;
const before = (level: CourseLevel, place: Place): boolean =>
  !!place?.start && LEVELS.indexOf(level) < LEVELS.indexOf(place.start);

export const stepsFor = (unit: Unit, place: Place): Step[] =>
  unit.steps.filter((s) => !s.only || s.only.includes(routeOf(place)));

export const isKnown = (s: Step, place: Place): boolean => {
  const u = unitOf(s, place);
  return before(u.level, place) || !!onPath(s, u).known?.includes(routeOf(place));
};
const onPath = (s: Step, u: Unit): Step => u.steps.find((x) => x.id === s.id) ?? s;

export const isOptional = (s: Step, place: Place): boolean => !!onPath(s, unitOf(s, place)).optional?.includes(routeOf(place)) || isKnown(s, place);

const LEGACY_SKIP: Record<string, string> = {
  'learn-introduction': 'learn-intro',
  'learn-king': 'learn-chesslike', 'learn-rook': 'learn-chesslike', 'learn-bishop': 'learn-chesslike',
  'learn-gold': 'learn-new-pieces', 'learn-silver': 'learn-new-pieces', 'learn-knight': 'learn-new-pieces', 'learn-lance': 'learn-new-pieces', 'learn-pawn': 'learn-new-pieces',
  'learn-capture': 'learn-drops', 'learn-drop': 'learn-drops', 'learn-protection': 'learn-drops',
  'learn-check1': 'learn-mate', 'learn-outOfCheck': 'learn-mate', 'learn-checkmate1': 'learn-mate',
  'learn-staticRook': 'learn-families', 'learn-rangingRook': 'learn-families',
  'learn-fourthFileRook': 'learn-ranging', 'learn-rangingCastles': 'learn-ranging',
  'learn-yagura': 'learn-static', 'learn-staticCastles': 'learn-static',
  'learn-centralRook': 'learn-central',
  'learn-primitiveClimbingSilver': 'learn-climbing', 'learn-climbingSilverVsRanging': 'learn-climbing',
  'learn-sittingSilver': 'learn-sitting', 'learn-whatIf': 'learn-whatif',
};
export const legacyOf = (id: string): string | undefined => LEGACY_SKIP[id];
export const isSkipped = (id: string, skipped: string[]): boolean =>
  skipped.includes(id) || (!!LEGACY_SKIP[id] && skipped.includes(LEGACY_SKIP[id]));

export type StepState = 'done' | 'skipped' | 'todo';

export function stepState(s: Step, p: SyncedProgress, levelCounts: Record<string, number>): StepState {
  if (isComplete(s, p, levelCounts)) return 'done';
  return isSkipped(s.id, p.course.skipped) ? 'skipped' : 'todo';
}

function isComplete(s: Step, p: SyncedProgress, levelCounts: Record<string, number>): boolean {
  switch (s.kind) {
    case 'rules': return p.rules.includes(s.rules!);
    case 'learn': return s.learn!.every((k) => stageDone(k, p, levelCounts));
    case 'try': return p.course.seen.includes(s.id);
    case 'read': return p.course.seen.includes(s.id);
    case 'tsume': return (p.tsume[String(s.tsume)]?.length ?? 0) >= (s.target ?? 1);
    case 'play': return (s.win ? p.course.won : p.course.played) >= s.play!;
  }
}

export function stageDone(key: string, p: SyncedProgress, levelCounts: Record<string, number>): boolean {
  const n = levelCounts[key] ?? 0;
  const scores = p.learn.stages[key]?.scores ?? [];
  return n > 0 && scores.slice(0, n).filter((x) => x > 0).length === n;
}

export function stepCount(s: Step, p: SyncedProgress, levelCounts: Record<string, number>): { done: number; of: number } | null {
  if (s.kind === 'learn' && s.learn!.length > 1) return { done: s.learn!.filter((k) => stageDone(k, p, levelCounts)).length, of: s.learn!.length };
  if (s.kind === 'tsume') return { done: Math.min(s.target ?? 1, p.tsume[String(s.tsume)]?.length ?? 0), of: s.target ?? 1 };
  return null;
}

export function stepHref(s: Step, p: SyncedProgress, levelCounts: Record<string, number>): string {
  switch (s.kind) {
    case 'rules': return `/rules/${s.rules}/`;
    case 'learn': return stageUrl(s.learn!.find((k) => !stageDone(k, p, levelCounts)) ?? s.learn![0]);
    case 'try':
    case 'read': return s.href!;
    case 'tsume': return `/tsume/${s.tsume}/`;
    case 'play': return `/play/?level=${s.play}`;
  }
}

export interface UnitProgress { done: number; of: number }
export function unitProgress(u: Unit, p: SyncedProgress, levelCounts: Record<string, number>): UnitProgress {
  const req = stepsFor(u, p.course).filter((s) => !isOptional(s, p.course));
  return { done: req.filter((s) => stepState(s, p, levelCounts) !== 'todo').length, of: req.length };
}

export function nextStep(p: SyncedProgress, levelCounts: Record<string, number>): { unit: Unit; step: Step } | undefined {
  for (const unit of curriculumFor(p.course.route)) {
    for (const step of stepsFor(unit, p.course)) {
      if (!isOptional(step, p.course) && stepState(step, p, levelCounts) === 'todo') return { unit, step };
    }
  }
  return undefined;
}

export function pathProgress(p: SyncedProgress, levelCounts: Record<string, number>): UnitProgress {
  return curriculumFor(p.course.route).map((u) => unitProgress(u, p, levelCounts)).reduce((a, b) => ({ done: a.done + b.done, of: a.of + b.of }), { done: 0, of: 0 });
}

export const hasAnyProgress = (p: SyncedProgress): boolean =>
  p.rules.length > 0 || Object.keys(p.learn.stages).length > 0 || Object.keys(p.tsume).length > 0 || p.course.played > 0;

export const whereLabel = (u: Unit): string => `${LEVEL_INFO[u.level].title} · ${u.title}`;

export const placeLabel = (place: Place): string =>
  place?.route && place.start ? `${LEVEL_INFO[place.start].title}${place.route === 'chess' ? ` · ${ROUTE_INFO.chess.label}` : ''}` : '';

export const KIND_LABEL: Record<StepKind, string> = {
  try: 'היכרות',
  rules: 'קריאה נוספת',
  learn: 'תרגול על הלוח',
  read: 'קריאה',
  tsume: 'בעיות מט',
  play: 'משחק',
};

export type Experience = 'none' | 'rules' | 'plays';
export function placeFrom(experience: Experience, chess: boolean, checkScore?: number): { route: Route; start: CourseLevel } {
  const route: Route = chess ? 'chess' : 'main';
  if (experience === 'none') return { route, start: 'beginner' };
  if (checkScore === undefined) return { route, start: 'intermediate' };
  return { route, start: checkScore >= 3 ? 'advanced' : checkScore === 2 ? 'intermediate' : 'beginner' };
}
