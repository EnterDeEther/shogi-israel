import type { PieceType } from './sfen';

export interface StoryPiece {
  id: string;
  t: PieceType;
  g: 0 | 1;
  r: number;
  c: number;
  pr?: boolean;
  out?: boolean;
  lift?: boolean;
  s?: number;
}

export interface BoardState {
  pcs: StoryPiece[];
  cap: string;
  hand?: boolean;
  zone?: boolean;
}

export interface StoryStep {
  key: string;
  text: string;
}

const BACK: PieceType[] = ['L', 'N', 'S', 'G', 'K', 'G', 'S', 'N', 'L'];

const START: StoryPiece[] = [
  ...BACK.flatMap((t, c): StoryPiece[] => [{ id: `g${t}${c}`, t, g: 1, r: 0, c }, { id: `s${t}${c}`, t, g: 0, r: 8, c }]),
  ...Array.from({ length: 9 }, (_, c): StoryPiece[] => [{ id: `gP${c}`, t: 'P', g: 1, r: 2, c }, { id: `sP${c}`, t: 'P', g: 0, r: 6, c }]).flat(),
  { id: 'gR', t: 'R', g: 1, r: 1, c: 1 }, { id: 'gB', t: 'B', g: 1, r: 1, c: 7 },
  { id: 'sR', t: 'R', g: 0, r: 7, c: 7 }, { id: 'sB', t: 'B', g: 0, r: 7, c: 1 },
];

const offBoard = (pcs: StoryPiece[]): StoryPiece[] => pcs.map((p) => (p.out ? { ...p, r: p.g ? -1.2 : 9.6 } : p));

const MID: StoryPiece[] = [
  { id: 'gK', t: 'K', g: 1, r: 0, c: 4 }, { id: 'gG', t: 'G', g: 1, r: 0, c: 3 }, { id: 'gS', t: 'S', g: 1, r: 1, c: 5 },
  { id: 'gP', t: 'P', g: 1, r: 3, c: 4 }, { id: 'gP2', t: 'P', g: 1, r: 2, c: 7 },
  { id: 'sS', t: 'S', g: 0, r: 4, c: 4 }, { id: 'sK', t: 'K', g: 0, r: 8, c: 4 }, { id: 'sG', t: 'G', g: 0, r: 8, c: 3 }, { id: 'sP', t: 'P', g: 0, r: 6, c: 0 },
];

const set = (pcs: StoryPiece[], id: string, ch: Partial<StoryPiece>): StoryPiece[] => pcs.map((p) => (p.id === id ? { ...p, ...ch } : p));
const took = set(MID, 'sS', { r: 3 });
const dropped = set(took, 'gP', { g: 0, r: 5, c: 2 });

export const BOARD_STORIES: Record<'a' | 'b', { first: BoardState; steps: Record<string, BoardState> }> = {
  a: {
    first: { pcs: offBoard(START.map((p) => ({ ...p, out: true }))), cap: 'הלוח: 9 על 9, כלומר 81 משבצות' },
    steps: {
      a0: { pcs: offBoard(START.map((p) => ({ ...p, out: true }))), cap: 'הלוח: 9 על 9, כלומר 81 משבצות' },
      a1: { pcs: offBoard(START.map((p) => ({ ...p, out: p.t !== 'K' }))), cap: 'המלך שלך למטה, המלך של היריב למעלה' },
      a2: { pcs: START, cap: 'הכלים של היריב הפוכים, עם החוד כלפי מטה' },
    },
  },
  b: {
    first: { pcs: MID, cap: 'דוגמה מאמצע משחק' },
    steps: {
      b0: { pcs: set(took, 'gP', { lift: true, s: 1.18 }), cap: 'דוגמה: הכלי שלך עולה משבצת ולוכד' },
      b1: { pcs: set(took, 'gP', { g: 0, r: 9.05, c: 4, s: 0.82 }), cap: 'הכלי הסתובב, ועכשיו הוא ביד שלך', hand: true },
      b2: { pcs: dropped, cap: 'הצנחה: הכלי חוזר ללוח, בצד שלך' },
      b3: { pcs: set(dropped, 'sS', { r: 2, c: 3, pr: true }), cap: 'הכתרה: הכלי התהפך, והסימן אדום', zone: true },
    },
  },
};

export const SHOW_CAPS: Record<string, string> = { c0: 'מלך בסט יפני', c1: 'אותו מלך, באות עברית', c2: 'למטה: שלך. למעלה: של היריב' };

export const STORY: Record<'a' | 'c' | 'b', StoryStep[]> = {
  a: [
    { key: 'a0', text: 'השם שוגי (<span lang="ja">将棋</span>) פירושו בערך <strong>משחק הגנרלים</strong>. שני שחקנים, לוח אחד של 9 על 9 משבצות, וכל אחד מפקד על צבא.' },
    { key: 'a1', text: 'לכל שחקן יש <strong>מלך</strong>. המטרה: לתקוף את המלך של היריב כך שאין לו לאן לברוח. זה נקרא <strong>מט</strong>, ומי שנותן מט מנצח.' },
    { key: 'a2', text: 'לכל צבא 20 כלים, וכל סוג זז אחרת. לא צריך לזכור כלום עכשיו: נכיר אותם אחד אחד, בפעם הראשונה שכל אחד זז.' },
  ],
  c: [
    { key: 'c0', text: 'על כלים יפניים כתוב <strong>קאנג׳י</strong>, הכתב היפני. ככה נראה מלך בסט יפני.' },
    { key: 'c1', text: 'כאן באתר כל כלי מסומן ב<strong>אות עברית</strong>: המלך הוא מ. אפשר לעבור בכל רגע לקאנג׳י, לאותיות באנגלית או לסמלי שחמט.' },
    { key: 'c2', text: 'לשני הצדדים אותו צבע. מה שאומר של מי הכלי הוא <strong>הכיוון</strong>: החוד של הכלים שלך פונה קדימה, אל היריב, והחוד של הכלים שלו פונה אליך.' },
  ],
  b: [
    { key: 'b0', text: 'כלי שלך <strong>לוכד</strong> כלי של היריב: הוא נכנס למשבצת שלו, והכלי של היריב יורד מהלוח.' },
    { key: 'b1', text: 'ופה ההפתעה: הכלי שנלכד לא יוצא מהמשחק. מסובבים אותו כך שהחוד פונה אל היריב, והוא <strong>עובר לצד שלך</strong> ומחכה ביד, ליד הלוח.' },
    { key: 'b2', text: 'בתור שלך אפשר להניח אותו בחזרה על הלוח, כמעט בכל משבצת פנויה, והוא נלחם בשבילך. זה נקרא <strong>הצנחה</strong>, ובגללה הלוח אף פעם לא מתרוקן.' },
    { key: 'b3', text: 'שלוש השורות האחרונות בצד של היריב הן אזור מיוחד. רוב הכלים שמגיעים אליו יכולים להתהפך ולהתחזק, והסימן שלהם נהיה אדום. זה נקרא <strong>הכתרה</strong>.' },
  ],
};

export const PHASES = [
  { h: 'פתיחה', p: 'מסדרים את הכלים ובונים הגנה סביב המלך.' },
  { h: 'אמצע המשחק', p: 'נפגשים, לוכדים ומחליפים כלים.' },
  { h: 'סוף המשחק', p: 'מרוץ למט.' },
];

export const HOME_FAQ = ['need-chess', 'japanese', 'cost', 'length', 'community'];

export const HERO_ART: [PieceType, number, number, number][] = [
  ['K', 0, 0, 1.25], ['R', -1.25, -0.55, 0.9], ['B', 1.2, -0.6, 0.9], ['G', -0.7, 0.75, 0.8], ['S', 0.75, 0.8, 0.8], ['P', 0, -1.45, 0.7],
];

export const allPieces = (story: 'a' | 'b'): (StoryPiece & { promotes: boolean })[] => {
  const seen = new Map<string, StoryPiece & { promotes: boolean }>();
  const { first, steps } = BOARD_STORIES[story];
  for (const st of [first, ...Object.values(steps)]) {
    for (const p of st.pcs) {
      const had = seen.get(p.id);
      seen.set(p.id, { ...(had ?? p), promotes: had?.promotes || !!p.pr });
    }
  }
  return [...seen.values()];
};
