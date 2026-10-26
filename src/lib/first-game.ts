// The first step for newcomers (/try/): one whole game, 27 moves, watched one click at a time.
// Every move has a title, a plain explanation for someone who knows nothing yet, and an optional "why".
// The moves are checked by test/first-game.test.ts (legal, ends in mate). Engine review (YaneuraOu,
// 2026-10-26): moves 1-20 are close to the engine's choice; at move 21 the engine prefers P*2c, which wins
// the bishop, and move 22 is the losing mistake the text calls one. The game is chosen to show the three
// phases, not to be perfect, and the page says so.
// Tags (capture, drop, promotion, check, mate) are worked out from the moves, not written by hand.
import { initialSfen, makeSfen, parseSfen } from 'shogiops/sfen';
import { parseUsi } from 'shogiops/util';
import type { Position } from 'shogiops/variant/position';

export interface FirstGameMove {
  usi: string;
  title: string;
  text: string;
  why?: string;
}

export interface Phase {
  name: string;
  /** Shown above the first move of the phase. */
  note: string;
  /** One line for the summary at the end. */
  recap: string;
  /** The move (1-based) the phase starts at. */
  first: number;
}

export const PHASES: Phase[] = [
  {
    name: 'פתיחה',
    note: 'בפתיחה עוד לא נלחמים. מזיזים את הכלים ממקומם, פותחים דרך לצריח, ובונים הגנה סביב המלך.',
    recap: 'מסדרים: מקדמים רגלים, מוציאים את הצריח לדרך, ומקרבים גנרלים של זהב וכסף למלך.',
    first: 1,
  },
  {
    name: 'אמצע המשחק',
    note: 'עכשיו הכלים נפגשים. מחליפים כלים, לוכדים ומצניחים, וכל צד מחפש דרך להגיע אל המלך של השני.',
    recap: 'נלחמים: מחליפים רגלים, לוכדים, ומצניחים בחזרה ללוח כלים שלכדנו.',
    first: 7,
  },
  {
    name: 'סוף המשחק',
    note: 'בסוף המשחק כבר לא סופרים כלים אלא מהלכים: מי שמגיע למט ראשון, מנצח. מכאן כל מהלך של הפותח הוא שח.',
    recap: 'מרוץ למט: כל מהלך הוא שח, ובסוף כלי שלכדנו חוזר ללוח ומסיים את המשחק.',
    first: 23,
  },
];

export const FIRST_GAME: FirstGameMove[] = [
  { usi: '2g2f', title: 'הרגלי שליד הצריח יוצא קדימה',
    text: 'הפותח מזיז צעד אחד את הרגלי שעומד לפני הצריח שלו. רגלי נע רק קדימה, צעד אחד בכל פעם.',
    why: 'כך נפתח לצריח הקו שבו הוא יוכל לצאת לדרך.' },
  { usi: '8c8d', title: 'המשיב עונה באותו מהלך',
    text: 'גם המשיב מזיז צעד אחד את הרגלי שלפני הצריח שלו. הצריחים של שני הצדדים עומדים בצדדים מנוגדים של הלוח.',
    why: 'שני הצדדים בחרו באותה תוכנית: לתקוף עם הצריח, מהצד.' },
  { usi: '2f2e', title: 'עוד צעד קדימה',
    text: 'הרגלי של הפותח ממשיך קדימה, אל אמצע הלוח.',
    why: 'הוא מתקרב לרגלי של המשיב, ושם ייפגשו שני הצדדים.' },
  { usi: '8d8e', title: 'גם המשיב מתקדם',
    text: 'הרגלי של המשיב מתקדם בצד השני. הלוח הוא תמונת ראי: כל צד עושה את אותו הדבר בצד שלו.' },
  { usi: '6i7h', title: 'גנרל הזהב יוצא לדרך',
    text: 'גנרל זהב זז צעד באלכסון קדימה, ויוצא ממקומו ליד המלך.',
    why: 'המלך הוא הכלי החשוב ביותר: אם הוא ננעל, המשחק נגמר. לכן מתחילים מוקדם לבנות לו מבצר מגנרלים של זהב וכסף.' },
  { usi: '4a3b', title: 'המשיב מחזק את הצד שלו',
    text: 'גנרל זהב של המשיב זז צעד באלכסון, אל ליד הרץ שלו, לצד שבו הוא מצפה להתקפה.',
    why: 'כלים שעומדים צמודים ומגנים אחד על השני קשה יותר ללכוד.' },
  { usi: '2e2d', title: 'הרגלי מאיים',
    text: 'הפותח מקדם את הרגלי עוד צעד, והוא עומד עכשיו ממש מול הרגלי של המשיב ומאיים ללכוד אותו.',
    why: 'רגלי לוכד כלי שנמצא ישר לפניו. אם המשיב לא יעשה כלום, הרגלי שלו יילכד בתור הבא.' },
  { usi: '2c2d', title: 'לכידה: המשיב לוכד קודם',
    text: 'הרגלי של המשיב לכד את הרגלי של הפותח. הכלי שנלכד יוצא מהלוח ועובר ליד מי שלכד אותו.',
    why: 'בשוגי כלי שנלכד לא נעלם. הוא נשאר ביד הלוכד, ואפשר להחזיר אותו ללוח בהמשך.' },
  { usi: '2h2d', title: 'הצריח לוכד חזרה',
    text: 'הצריח נע בקו ישר לאורך כל הדרך ולוכד את הרגלי שלכד. עכשיו ביד הפותח יש רגלי.',
    why: 'צריח נע בקו ישר, כמה משבצות שרוצים, עד שהוא פוגש כלי.' },
  { usi: 'P*2c', title: 'הצנחה: כלי חוזר ללוח',
    text: 'המשיב לוקח את הרגלי שלכד ומצניח אותו ללוח, ישר מול הצריח, כדי לחסום אותו. הצנחה היא מהלך שבו במקום להזיז כלי על הלוח, מניחים כלי מהיד על משבצת פנויה.',
    why: 'בלי הרגלי הזה הצריח היה מאיים על הרץ של המשיב. רגלי קטן עצר אותו.' },
  { usi: '2d2f', title: 'הצריח נסוג',
    text: 'הרגלי החדש של המשיב מאיים ללכוד את הצריח, כי רגלי לוכד קדימה. הפותח מחזיר את הצריח אחורה.',
    why: 'כלי קטן יכול לאיים על כלי גדול, ולכן צריך תמיד להסתכל מה מאיים על הכלים שלנו.' },
  { usi: '7a7b', title: 'גנרל כסף זז',
    text: 'גנרל כסף נע צעד אחד: קדימה, או לאחד מארבעת האלכסונים. המשיב מקרב אותו למרכז.',
    why: 'גם הגנרלים זזים רק צעד אחד, אבל אחרי כמה מהלכים הם יוצרים חומה סביב המלך.' },
  { usi: '3i3h', title: 'גם הפותח מקדם גנרל כסף',
    text: 'גנרל הכסף של הפותח זז צעד קדימה, מתקרב לאמצע ומתכונן להתקפה.' },
  { usi: '6c6d', title: 'עוד רגלי',
    text: 'המשיב מקדם רגלי נוסף, כדי לפנות משבצת לכלים שמאחוריו.',
    why: 'בשוגי יש הרבה מהלכי רגלי. הם פותחים דרכים לכלים החזקים יותר.' },
  { usi: '3g3f', title: 'הפותח מפנה דרך',
    text: 'הרגלי שלפני גנרל הכסף מתקדם, וכך מתפנה לגנרל הכסף מקום להתקדם אחריו.' },
  { usi: '5c5d', title: 'רגלי במרכז',
    text: 'המשיב מקדם את הרגלי שלפני המלך שלו. זה נראה מהלך רגיל.',
    why: 'עכשיו הקו שמול המלך שלו פתוח יותר: נשאר בו רק הרגלי הזה. הקו הזה ישחק תפקיד בהמשך.' },
  { usi: 'P*2d', title: 'הצנחה של הפותח',
    text: 'הפותח מצניח את הרגלי שהוא מחזיק ביד, ישר מול הרגלי של המשיב. הצריח שלו עומד מאחור ומגן על הרגלי.',
    why: 'כך משתמשים בכלי שנלכד כמו בכלי רגיל.' },
  { usi: '2c2d', title: 'החלפה',
    text: 'המשיב לוכד את הרגלי שהוצנח. הרגלי שלו עומד עכשיו על משבצת שהצריח של הפותח רואה.',
    why: 'זו החלפת רגלים: כל צד לוכד רגלי של השני.' },
  { usi: '2f2d', title: 'הצריח לוכד ונכנס עמוק',
    text: 'הצריח לוכד את הרגלי ועומד עכשיו עמוק בצד של המשיב. משם הוא רואה לאורך כל השורה, עד אמצע הלוח.',
    why: 'שורה פתוחה היא כמו כביש מהיר לצריח, והיא מובילה אל הקו שבו נמצא המלך של המשיב.' },
  { usi: '6a5b', title: 'המשיב מגן על המלך',
    text: 'המשיב רואה שהצריח יכול ללכוד רגלי במרכז ולתת שח. שח הוא איום ישיר על המלך, וחייבים להגיב עליו מיד. הוא מקדים ומזיז גנרל זהב אל מול המלך.',
    why: 'גנרל הזהב חוסם את הקו אל המלך.' },
  { usi: '2d5d', title: 'הצריח לוכד רגלי במרכז',
    text: 'הצריח נע לאורך כל השורה ולוכד רגלי של המשיב. עכשיו הוא עומד מול גנרל הזהב, ויש לפותח שני רגלים ביד.',
    why: 'הצריח בטוח שם: אף כלי של המשיב לא יכול ללכוד אותו.' },
  { usi: '5b5c', title: 'המשיב מנסה לגרש את הצריח',
    text: 'גנרל הזהב צועד קדימה ומאיים ללכוד את הצריח. זה נראה מהלך טוב, אבל זו טעות: הגנרל נשאר בלי הגנה.',
    why: 'כלי שאף כלי לא מגן עליו אפשר ללכוד בלי לשלם. הפותח מנצל את זה מיד, ומכאן מתחיל המרוץ למט.' },
  { usi: '5d5c+', title: 'הצריח לוכד גנרל, מוכתר, ושח!',
    text: 'הצריח לוכד את גנרל הזהב, ובדרך נכנס לאזור ההכתרה: שלוש השורות האחרונות אצל היריב. שם כלי יכול להתהפך ולקבל כוח חדש. הצריח המוכתר נקרא דרקון: הוא נע כמו צריח וגם צעד אחד באלכסון.',
    why: 'והוא נותן שח: המלך מותקף. עכשיו ביד הפותח גם גנרל זהב.' },
  { usi: 'P*5b', title: 'המשיב חוסם בהצנחה',
    text: 'כדי להגן על המלך, המשיב מצניח רגלי אל המשבצת שבין הדרקון למלך. השח נחסם.',
    why: 'בשח יש שלוש תשובות: להזיז את המלך, ללכוד את המאיים, או לחסום בדרך. כאן אי אפשר ללכוד, והמשיב בחר לחסום.' },
  { usi: 'G*6b', title: 'הגנרל שנלכד חוזר ללוח, שח',
    text: 'הפותח מצניח את גנרל הזהב שלכד לפני רגע, ועכשיו הגנרל משחק בצד שלו ונותן שח. הדרקון מגן עליו, ולכן אי אפשר ללכוד אותו.',
    why: 'כלי שלכדתם יכול להפוך לכלי המכריע.' },
  { usi: '5a4a', title: 'המלך בורח',
    text: 'נשארה למשיב דרך אחת בלבד: המלך זז צעד אחד הצידה.' },
  { usi: '6b5b', title: 'מט!',
    text: 'גנרל הזהב לוכד את הרגלי החוסם ונותן שח שאין ממנו מוצא: המלך לא יכול לברוח, ללכוד או לחסום. זה מט, והמשחק נגמר.',
    why: 'המט הגיע מכלי שהמשיב איבד שלושה מהלכים קודם. זה הכוח של ההצנחה.' },
];

export type Tag = 'capture' | 'drop' | 'promotion' | 'check' | 'mate';
export const TAG_LABEL: Record<Tag, string> = { capture: 'לכידה', drop: 'הצנחה', promotion: 'הכתרה', check: 'שח', mate: 'מט' };

export interface Ply {
  /** The position after this move (index 0: the start). */
  pos: Position;
  sfen: string;
  tags: Tag[];
  /** Phase index (0-2) of this move; -1 for the start. */
  phase: number;
}

const phaseOf = (n: number): number => PHASES.reduce((p, ph, i) => (n >= ph.first ? i : p), 0);

/** Every position of the game, from the start to the mate, with each move's tags. Throws on an illegal move. */
export function firstGamePlies(moves: FirstGameMove[] = FIRST_GAME): Ply[] {
  const pos = parseSfen('standard', initialSfen('standard')).unwrap();
  const out: Ply[] = [{ pos: pos.clone(), sfen: makeSfen(pos), tags: [], phase: -1 }];
  moves.forEach((m, i) => {
    const md = parseUsi(m.usi);
    if (!md || !pos.isLegal(md)) throw new Error(`move ${i + 1} (${m.usi}) is not legal`);
    const tags: Tag[] = [];
    if ('role' in md) tags.push('drop');
    else if (pos.board.has(md.to)) tags.push('capture');
    if (!('role' in md) && md.promotion) tags.push('promotion');
    pos.play(md);
    if (pos.outcome()?.result === 'checkmate') tags.push('mate');
    else if (pos.isCheck()) tags.push('check');
    out.push({ pos: pos.clone(), sfen: makeSfen(pos), tags, phase: phaseOf(i + 1) });
  });
  return out;
}
