// The Rules course outline. A lesson is live when its MDX file exists in src/content/rules/.
export interface LessonStub { n: number; slug: string; title: string }

export const RULES_COURSE: LessonStub[] = [
  { n: 1, slug: '01-board-pieces-setup', title: 'הלוח, הכלים והעמדה הפותחת' },
  { n: 2, slug: '02-how-pieces-move', title: 'איך כל כלי זז' },
  { n: 3, slug: '03-promotion', title: 'הכתרה' },
  { n: 4, slug: '04-capture-drops', title: 'לכידה והצנחה' },
  { n: 5, slug: '05-check-mate', title: 'שח ומט' },
  { n: 6, slug: '06-illegal-moves-endings', title: 'מסעים לא חוקיים ואיך משחק נגמר' },
  { n: 7, slug: '07-reading-pieces', title: 'לקרוא את הכלים' },
  { n: 8, slug: '08-reading-notation', title: 'לקרוא רישום משחק' },
];

export const pad = (n: number) => String(n).padStart(2, '0');

// Interactive practice (/learn/<stage>/) that matches each Rules lesson.
// Stage keys are Lishogi Learn stage keys (src/learn/stages/*.ts). A link only shows once the stage is in the engine.
export const PRACTICE: Record<string, { stage: string; title: string }[]> = {
  // Final map from content/learn/lesson-stage-map.md (content chat, 2026-10-24 15:55).
  '01-board-pieces-setup': [{ stage: 'introduction', title: 'הכרת הלוח' }],
  '02-how-pieces-move': [
    { stage: 'king', title: 'מלך' },
    { stage: 'gold', title: 'גנרל זהב' },
    { stage: 'silver', title: 'גנרל כסף' },
    { stage: 'knight', title: 'פרש' },
    { stage: 'lance', title: 'רומח' },
    { stage: 'bishop', title: 'רץ' },
    { stage: 'rook', title: 'צריח' },
    { stage: 'pawn', title: 'רגלי' },
  ],
  '03-promotion': [{ stage: 'il_promotion', title: 'הכתרה' }],
  '04-capture-drops': [
    { stage: 'capture', title: 'לכידה' },
    { stage: 'drop', title: 'הצנחה' },
    { stage: 'protection', title: 'הגנה על כלים' },
  ],
  '05-check-mate': [
    { stage: 'check1', title: 'שח' },
    { stage: 'outOfCheck', title: 'יציאה משח' },
    { stage: 'checkmate1', title: 'מט במסע אחד' },
  ],
  '06-illegal-moves-endings': [
    { stage: 'repetition', title: 'חזרה על עמדה' },
    { stage: 'il_illegal', title: 'מצאו את המסע הלא חוקי' },
    { stage: 'il_impasse', title: 'הכרזת 27 נקודות' },
  ],
  '07-reading-pieces': [{ stage: 'il_kanji', title: 'זיהוי כלים בקאנג׳י' }],
  '08-reading-notation': [{ stage: 'il_notation', title: 'קריאת רישום' }],
};
