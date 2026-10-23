// The Rules course outline. A lesson is live when its MDX file exists in src/content/rules/.
export interface LessonStub { n: number; slug: string; title: string }

export const RULES_COURSE: LessonStub[] = [
  { n: 1, slug: '01-board-pieces-setup', title: 'הלוח, הכלים והעמדה הפותחת' },
  { n: 2, slug: '02-how-pieces-move', title: 'איך כל כלי זז' },
  { n: 3, slug: '03-promotion', title: 'הכתרה' },
  { n: 4, slug: '04-drops', title: 'הצנחה' },
  { n: 5, slug: '05-illegal-moves', title: 'מהלכים אסורים' },
  { n: 6, slug: '06-winning', title: 'איך מנצחים' },
  { n: 7, slug: '07-reading-pieces', title: 'לקרוא את הכלים' },
  { n: 8, slug: '08-reading-notation', title: 'לקרוא רישום מהלכים' },
];

export const pad = (n: number) => String(n).padStart(2, '0');
