// The guided course (/course/, "מסלול לימוד אישי"): one ordered path through everything on the site that teaches,
// from the first rules lesson to tsume, grouped as the basics and then the three phases of a game
// (פתיחה, אמצע המשחק, סוף המשחק). The answer to "where do you start?" (a Track) decides which steps
// are part of the path and which are optional. Progress comes from what the lessons, tsume and play already
// save (src/lib/progress-sync.ts); nothing here is stored twice.
// Pure data and functions (tested in test/curriculum.test.ts).
import { stageUrl } from '../learn/urls';
import type { SyncedProgress, Track } from './progress-sync';

export type StepKind = 'rules' | 'learn' | 'read' | 'tsume' | 'play';

export interface Step {
  id: string;
  kind: StepKind;
  title: string;
  /** Why this step, in one line: shown under the title. */
  why: string;
  minutes: number;
  /** rules: lesson slug. learn: stage keys (done when all are done). read: a page (#section). tsume: length. play: level. */
  rules?: string;
  learn?: string[];
  href?: string;
  tsume?: 1 | 3 | 5 | 7;
  /** tsume: puzzles to solve. */
  target?: number;
  play?: number;
  /** play: a win is needed, not just a finished game. */
  win?: boolean;
  /** Only part of the path for these starting points (default: all). */
  only?: Track[];
  /** Optional for these starting points: shown, but the path doesn't wait for it. */
  optional?: Track[];
}

export interface Unit {
  key: 'basics' | 'opening' | 'middle' | 'endgame';
  /** The game phase this unit teaches; the basics come before the phases. */
  phase?: number;
  title: string;
  goal: string;
  why: string;
  steps: Step[];
}

export const TRACK_INFO: Record<Track, { label: string; sub: string; start: string }> = {
  new: {
    label: 'חדשים לגמרי',
    sub: 'עוד לא שיחקתם שוגי, וגם לא שחמט',
    start: 'נתחיל מהלוח והכלים, צעד אחר צעד. אין צורך בשום ידע קודם.',
  },
  chess: {
    label: 'משחקים שחמט',
    sub: 'יודעים איך זזים מלך, צריח ורץ',
    start: 'נדלג על מה שמוכר לכם מהשחמט ונתמקד במה שחדש: הכלים החדשים, הכתרה והצנחה.',
  },
  shogi: {
    label: 'כבר מכירים את החוקים',
    sub: 'שיחקתם שוגי, ורוצים להשתפר',
    start: 'היסודות פתוחים לרענון, אבל המסלול מתחיל בפתיחה: מבצרים, תוכניות ובעיות מט.',
  },
};

const ALL_BUT_NEW: Track[] = ['chess', 'shogi'];

export const CURRICULUM: Unit[] = [
  {
    key: 'basics',
    title: 'יסודות',
    goal: 'לפני המשחק הראשון',
    why: 'לפני שמדברים על שלבי המשחק צריך לדעת לשחק: הלוח, איך כל כלי זז, ושני הדברים שאין בשחמט, הכתרה והצנחה. בסוף משחקים משחק ראשון.',
    steps: [
      { id: 'rules-01', kind: 'rules', rules: '01-board-pieces-setup', title: 'הלוח, הכלים והעמדה הפותחת', why: 'הלוח של 9×9, עשרים הכלים של כל צד, ואיך מסדרים אותם.', minutes: 10, optional: ALL_BUT_NEW },
      { id: 'learn-intro', kind: 'learn', learn: ['introduction'], title: 'תרגול: מזיזים כלי ראשון', why: 'איך מזיזים כלים על הלוח באתר, לפני כל השאר.', minutes: 3, optional: ALL_BUT_NEW },
      { id: 'rules-02', kind: 'rules', rules: '02-how-pieces-move', title: 'איך כל כלי זז', why: 'כל שמונת הכלים, עם הסבר למה כל אחד בנוי כך.', minutes: 15, optional: ['shogi'] },
      { id: 'learn-chesslike', kind: 'learn', learn: ['king', 'rook', 'bishop'], title: 'תרגול: מלך, צריח ורץ', why: 'שלושת הכלים שזזים כמו בשחמט.', minutes: 10, optional: ALL_BUT_NEW },
      { id: 'learn-new-pieces', kind: 'learn', learn: ['gold', 'silver', 'knight', 'lance', 'pawn'], title: 'תרגול: זהב, כסף, פרש, רומח ורגלי', why: 'הכלים שאין בשחמט, או שזזים בו אחרת. כאן רוב ההבדל.', minutes: 20, optional: ['shogi'] },
      { id: 'rules-03', kind: 'rules', rules: '03-promotion', title: 'הכתרה', why: 'למה כמעט כל כלי מתחזק כשהוא נכנס לשטח של היריב.', minutes: 10, optional: ['shogi'] },
      { id: 'rules-04', kind: 'rules', rules: '04-drops', title: 'לכידה והצנחה', why: 'הכלל שהופך את השוגי לשוגי: כלי שלכדתם עובר לצד שלכם.', minutes: 10, optional: ['shogi'] },
      { id: 'learn-drops', kind: 'learn', learn: ['capture', 'drop', 'protection'], title: 'תרגול: לכידה, הצנחה והגנה', why: 'על הלוח, עד שההצנחה נעשית טבעית.', minutes: 20, optional: ['shogi'] },
      { id: 'rules-05', kind: 'rules', rules: '05-check-mate', title: 'שח ומט', why: 'איך מנצחים, ומה שונה מהשחמט כשאפשר להצניח כלי ליד המלך.', minutes: 10, optional: ['shogi'] },
      { id: 'learn-mate', kind: 'learn', learn: ['check1', 'outOfCheck', 'checkmate1'], title: 'תרגול: שח, יציאה משח ומט במהלך אחד', why: 'הבסיס לכל התקפה, ולבעיות המט בסוף המסלול.', minutes: 25, optional: ['shogi'] },
      { id: 'rules-06', kind: 'rules', rules: '06-illegal-moves-endings', title: 'מהלכים לא חוקיים ואיך משחק נגמר', why: 'מהלך לא חוקי מפסיד במקום. ועוד: כניעה, חזרה על עמדה, ומלך שחודר לשטח היריב.', minutes: 10, optional: ['shogi'] },
      { id: 'play-first', kind: 'play', play: 1, title: 'משחק ראשון נגד המחשב', why: 'רמה 1 סלחנית. המטרה רק לסיים משחק שלם, לא לנצח.', minutes: 15, only: ['new', 'shogi'], optional: ['shogi'] },
      { id: 'play-first-chess', kind: 'play', play: 3, title: 'משחק ראשון נגד המחשב, ברמה 3', why: 'רמה שמענישה טעויות, אבל אפשר לנצח בה. ניצחתם? עלו רמה.', minutes: 20, only: ['chess'] },
      { id: 'rules-07', kind: 'rules', rules: '07-reading-pieces', title: 'לקרוא את הכלים', why: 'על כלים אמיתיים כתוב קאנג׳י. 14 סימנים, ואתם קוראים כל לוח בעולם.', minutes: 10, optional: ['new', 'chess', 'shogi'] },
      { id: 'rules-08', kind: 'rules', rules: '08-reading-notation', title: 'לקרוא רישום משחק', why: 'איך כותבים מהלכים, כדי לקרוא ספרים, בעיות ומשחקים מוקלטים.', minutes: 10, optional: ['new', 'chess', 'shogi'] },
    ],
  },
  {
    key: 'opening',
    phase: 1,
    title: 'פתיחה',
    goal: 'להתארגן',
    why: 'משחררים את הצריח והרץ, בוחרים באיזה צד תוקפים, ובונים מבצר סביב המלך. מי שמתארגן טוב נכנס לאמצע המשחק מוכן.',
    steps: [
      { id: 'read-opening', kind: 'read', href: '/learn/guide/#opening', title: 'מה זו פתיחה, ולמה צריך אותה', why: 'ארבעה דברים שפתיחה טובה עושה, ושתי משפחות הפתיחות.', minutes: 5 },
      { id: 'learn-families', kind: 'learn', learn: ['staticRook', 'rangingRook'], title: 'צריח קבוע וצריח נודד', why: 'שתי המשפחות בקצרה: איפה הצריח תוקף, ולאן המלך הולך.', minutes: 10 },
      { id: 'read-castle', kind: 'read', href: '/learn/guide/#castle', title: 'מבצר: למה אין הצרחה בשוגי', why: 'למה המלך צריך חומה של גנרלים, ואיך בוחרים מבצר לפתיחה.', minutes: 5 },
      { id: 'learn-ranging', kind: 'learn', learn: ['fourthFileRook', 'rangingCastles'], title: 'פתיחה ראשונה: צריח בטור 6 ומבצר מינו', why: 'פתיחה בטוחה ופשוטה לצריח נודד, עם המבצר שמתאים לה.', minutes: 20 },
      { id: 'learn-static', kind: 'learn', learn: ['yagura', 'staticCastles'], title: 'פתיחה שנייה: יגורה ומבצרים לצריח קבוע', why: 'פתיחה אחת מכל משפחה, וכך תבינו גם מה היריב מתכנן נגדכם.', minutes: 20 },
      { id: 'learn-central', kind: 'learn', learn: ['centralRook'], title: 'צריח מרכזי', why: 'עוד דרך לצריח נודד, עם התקפה ישירה במרכז.', minutes: 8, optional: ['new', 'chess', 'shogi'] },
      { id: 'learn-more-openings', kind: 'learn', learn: ['thirdFileRook', 'bishopExchange', 'ishida', 'quickIshida', 'opposingRook', 'doubleRangingRook', 'sidePawn', 'twistingRook'], title: 'עוד פתיחות', why: 'אישידה, חילוף רצים, צריח מתפתל ועוד. כשתרצו גיוון.', minutes: 45, optional: ['new', 'chess', 'shogi'] },
      { id: 'play-opening', kind: 'play', play: 2, title: 'משחק: קודם מבצר, אחר כך התקפה', why: 'שחקו נגד רמה 2 או יותר, ונסו לסיים מבצר לפני ההתקפה הראשונה.', minutes: 20 },
    ],
  },
  {
    key: 'middle',
    phase: 2,
    title: 'אמצע המשחק',
    goal: 'לפרוץ',
    why: 'שני הצדדים מוכנים, ועכשיו תוקפים לפי תוכנית. מחליפים כלים, וכל כלי שנלכד נכנס ליד ומחכה להצנחה.',
    steps: [
      { id: 'read-strategy', kind: 'read', href: '/learn/guide/#strategy', title: 'אסטרטגיה: איך בונים התקפה', why: 'התקפה מהירה או משחק איטי, ורעיונות שחוזרים בכל תוכנית.', minutes: 5 },
      { id: 'learn-value', kind: 'learn', learn: ['value'], title: 'ערך הכלים: מתי חילוף משתלם', why: 'ערכי החומר מהשחמט לא עובדים כאן, כי כל כלי שנלכד חוזר כהצנחה.', minutes: 15 },
      { id: 'learn-climbing', kind: 'learn', learn: ['primitiveClimbingSilver', 'climbingSilverVsRanging'], title: 'כסף מטפס', why: 'התוכנית הראשונה של צריח קבוע: שני תוקפים מול מגן אחד.', minutes: 15 },
      { id: 'learn-sitting', kind: 'learn', learn: ['sittingSilver'], title: 'כסף יושב', why: 'תוכנית איטית ובטוחה יותר, כשהיריב כבר מוכן להתקפה מהירה.', minutes: 10 },
      { id: 'learn-whatif', kind: 'learn', learn: ['whatIf'], title: 'מה אם היריב טועה?', why: 'טעויות נפוצות של היריב, ואיך מענישים אותן.', minutes: 10 },
      { id: 'learn-more-plans', kind: 'learn', learn: ['chainedSilver', 'bishopClimbingSilver', 'rapidSilver', 'bishopSittingSilver', 'spearingSparrow'], title: 'עוד תוכניות התקפה', why: 'כסף מהיר, שיפוד הדרור ועוד, למי שרוצה להעמיק.', minutes: 30, optional: ['new', 'chess', 'shogi'] },
      { id: 'play-middle', kind: 'play', play: 3, title: 'משחק: תוקפים לפי תוכנית', why: 'שחקו נגד רמה 3 או יותר, ובחרו תוכנית לפני שאתם תוקפים.', minutes: 25 },
    ],
  },
  {
    key: 'endgame',
    phase: 3,
    title: 'סוף המשחק',
    goal: 'להכריע',
    why: 'המבצר נפרץ, וההתקפה הופכת למירוץ: מי שמגיע למט ראשון מנצח. כאן ספירת מהלכים חשובה יותר מחומר, ובעיות מט הן האימון הישיר.',
    steps: [
      { id: 'read-endgame', kind: 'read', href: '/learn/guide/#endgame', title: 'סוף המשחק: מירוץ למט', why: 'למה בסוף המשחק אפשר לוותר על כלים כדי להגיע למט מהר יותר.', minutes: 3 },
      { id: 'tsume-1', kind: 'tsume', tsume: 1, target: 20, title: 'בעיות מט במהלך אחד', why: 'פתרו 20, עד שאתם רואים מט במבט אחד.', minutes: 20 },
      { id: 'tsume-3', kind: 'tsume', tsume: 3, target: 10, title: 'בעיות מט ב־3 מהלכים', why: 'פתרו 10: שח, תשובה של המגן, ומט.', minutes: 25 },
      { id: 'tsume-5', kind: 'tsume', tsume: 5, target: 5, title: 'בעיות מט ב־5 מהלכים', why: 'פתרו 5. כאן מתחילות ההקרבות.', minutes: 25 },
      { id: 'play-win', kind: 'play', play: 4, win: true, title: 'נצחו את המחשב ברמה 4', why: 'כל המסלול במשחק אחד: פתיחה, תוכנית, ומירוץ למט.', minutes: 30 },
      { id: 'tsume-7', kind: 'tsume', tsume: 7, target: 3, title: 'בעיות מט ב־7 מהלכים', why: 'לשחקנים עם ניסיון: פתרו 3.', minutes: 30, optional: ['new', 'chess', 'shogi'] },
    ],
  },
];

export const ALL_STEPS: Step[] = CURRICULUM.flatMap((u) => u.steps);

/** The steps of a unit that belong to this starting point (no track yet: as for 'new'). */
export const stepsFor = (unit: Unit, track: Track | null): Step[] =>
  unit.steps.filter((s) => !s.only || s.only.includes(track ?? 'new'));

export const isOptional = (s: Step, track: Track | null): boolean => !!s.optional?.includes(track ?? 'new');

export type StepState = 'done' | 'skipped' | 'todo';

/** levelCounts: stage key → number of levels (src/learn/categories.ts, at build time). */
export function stepState(s: Step, p: SyncedProgress, levelCounts: Record<string, number>): StepState {
  if (isComplete(s, p, levelCounts)) return 'done';
  return p.course.skipped.includes(s.id) ? 'skipped' : 'todo';
}

function isComplete(s: Step, p: SyncedProgress, levelCounts: Record<string, number>): boolean {
  switch (s.kind) {
    case 'rules': return p.rules.includes(s.rules!);
    case 'learn': return s.learn!.every((k) => stageDone(k, p, levelCounts));
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

/** Progress inside a multi-part step, for its label ("2 מתוך 5"). null for one-part steps. */
export function stepCount(s: Step, p: SyncedProgress, levelCounts: Record<string, number>): { done: number; of: number } | null {
  if (s.kind === 'learn' && s.learn!.length > 1) return { done: s.learn!.filter((k) => stageDone(k, p, levelCounts)).length, of: s.learn!.length };
  if (s.kind === 'tsume') return { done: Math.min(s.target ?? 1, p.tsume[String(s.tsume)]?.length ?? 0), of: s.target ?? 1 };
  return null;
}

/** Where a step's link goes: the first unfinished stage of a learn step, the next unsolved length for tsume. */
export function stepHref(s: Step, p: SyncedProgress, levelCounts: Record<string, number>): string {
  switch (s.kind) {
    case 'rules': return `/rules/${s.rules}/`;
    case 'learn': return stageUrl(s.learn!.find((k) => !stageDone(k, p, levelCounts)) ?? s.learn![0]);
    case 'read': return s.href!;
    case 'tsume': return `/tsume/${s.tsume}/`;
    case 'play': return `/play/?level=${s.play}`;
  }
}

export interface UnitProgress { done: number; of: number }
/** Required steps finished (done or skipped) out of the required steps, for this starting point. */
export function unitProgress(u: Unit, p: SyncedProgress, levelCounts: Record<string, number>): UnitProgress {
  const req = stepsFor(u, p.course.track).filter((s) => !isOptional(s, p.course.track));
  return { done: req.filter((s) => stepState(s, p, levelCounts) !== 'todo').length, of: req.length };
}

/** The next required step not yet done or skipped, in path order; undefined when the whole path is done. */
export function nextStep(p: SyncedProgress, levelCounts: Record<string, number>): { unit: Unit; step: Step } | undefined {
  for (const unit of CURRICULUM) {
    for (const step of stepsFor(unit, p.course.track)) {
      if (!isOptional(step, p.course.track) && stepState(step, p, levelCounts) === 'todo') return { unit, step };
    }
  }
  return undefined;
}

export function pathProgress(p: SyncedProgress, levelCounts: Record<string, number>): UnitProgress {
  return CURRICULUM.map((u) => unitProgress(u, p, levelCounts)).reduce((a, b) => ({ done: a.done + b.done, of: a.of + b.of }), { done: 0, of: 0 });
}

/** Has this visitor done anything on the site that the course counts? (to show "continue" before a track is chosen) */
export const hasAnyProgress = (p: SyncedProgress): boolean =>
  p.rules.length > 0 || Object.keys(p.learn.stages).length > 0 || Object.keys(p.tsume).length > 0 || p.course.played > 0;

export const KIND_LABEL: Record<StepKind, string> = {
  rules: 'שיעור',
  learn: 'תרגול על הלוח',
  read: 'קריאה',
  tsume: 'בעיות מט',
  play: 'משחק',
};
