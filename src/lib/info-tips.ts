export interface TipDef {
  label: string;
  text: string;
  more?: { href: string; text: string };
}

export const TIPS = {
  rank: {
    label: 'הדרגה שלך',
    text: 'זו הדרגה שלך בלימוד באתר. היא עולה עם שיעורים, בעיות ומשחקים, ולא מודדת כמה חזק ⟦אתה|את⟧ ⟦משחק|משחקת⟧. כמו בג׳ודו, הספירה היא לאחור: 15 קיו היא ההתחלה, ואחרי 1 קיו ⟦אתה|את⟧ ⟦מגיע|מגיעה⟧ לדאן.',
    more: { href: '/ranks/#site', text: 'מה ההבדל מדרגה אמיתית?' },
  },
  points: {
    label: 'נקודות',
    text: 'הנקודות מעלות את הדרגה שלך. ⟦אתה|את⟧ ⟦מקבל|מקבלת⟧ אותן על שיעורים, בעיות מט ומשחקים נגד המחשב. כל דבר נספר פעם אחת, ולכן חזרה על בעיה שכבר פתרת לא מוסיפה נקודות.',
    more: { href: '/ranks/#site', text: 'איך אפשר לצבור נקודות?' },
  },
  mate: {
    label: 'מספר המהלכים בבעיה',
    text: 'המספר סופר את כל המהלכים עד המט, גם של היריב. למשל, מט ב־3 מהלכים הוא שח שלך, תשובה של היריב, ומט. לכן המספר תמיד אי זוגי.',
    more: { href: '/tsume/#rules', text: 'מה החוקים של בעיית מט?' },
  },
  pieces: {
    label: 'סימון הכלים',
    text: 'כאן ⟦אתה|את⟧ ⟦בוחר|בוחרת⟧ איך הכלים מסומנים על הלוח: באותיות בעברית (מ למלך, צ לצריח…), באותיות באנגלית (K, R…) או בקאנג׳י, הסימנים היפניים שעל כלי שוגי אמיתיים. הבחירה חלה על כל האתר.',
    more: { href: '/rules/07-reading-pieces/', text: 'איך אפשר לקרוא את הכלים?' },
  },
  sides: {
    label: 'פותח ומשיב',
    text: 'הפותח (☗) הוא מי שמשחק ראשון, והמשיב (☖) משחק אחריו. כלי כל צד פונים אל הצד השני, וכך ⟦אתה|את⟧ רואה של מי כל כלי.',
    more: { href: '/rules/01-board-pieces-setup/', text: 'איך אפשר לסדר את הלוח?' },
  },
  kif: {
    label: 'רישום המשחק (KIF)',
    text: 'KIF הוא קובץ עם כל המהלכים של המשחק שלך. אפשר לשמור אותו, לשלוח אותו לחבר, או לפתוח אותו בליש׳וגי כדי שמנוע חזק יראה לך איפה טעית.',
    more: { href: '/kif/', text: 'מה עוד אפשר לעשות עם KIF?' },
  },
  phases: {
    label: 'שלבי המשחק',
    text: 'למשחק שוגי שלושה שלבים: פתיחה (להתארגן), אמצע המשחק (לפרוץ) וסוף המשחק (להכריע). במסלול ⟦אתה|את⟧ ⟦לומד|לומדת⟧ אותם לפי הסדר.',
    more: { href: '/learn/guide/#phases', text: 'מה קורה בכל שלב?' },
  },
} satisfies Record<string, TipDef>;

export type TipId = keyof typeof TIPS;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

let seq = 0;
const nextUid = () => `tip-${typeof document === 'undefined' ? 's' : 'c'}${++seq}`;

const CLOSE_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

export function tipMarkup(id: TipId, uid: string = nextUid()): string {
  const t: TipDef = TIPS[id];
  const more = t.more ? `<a class="info-tip__more" href="${esc(t.more.href)}">${esc(t.more.text)}</a>` : '';
  return (
    `<span class="info-tip">` +
    `<button type="button" class="info-tip__btn" popovertarget="${uid}" aria-expanded="false" aria-label="הסבר קצר: ${esc(t.label)}">?</button>` +
    `<span class="info-tip__pop" id="${uid}" popover="auto" role="note">` +
    `<span class="info-tip__arrow" aria-hidden="true"></span>` +
    `<span class="info-tip__text">${esc(t.text)}</span>${more}` +
    `<button type="button" class="info-tip__x" popovertarget="${uid}" popovertargetaction="hide" aria-label="סגירה">${CLOSE_ICON}</button>` +
    `</span></span>`
  );
}
