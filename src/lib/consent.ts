// The wording of the opt-in boxes for email nudges (account settings and sign-up form), kept apart from
// src/lib/notify.ts so pages can show it without loading the email logic.
// Bump CONSENT_VERSION whenever the wording changes: the database keeps which version each player agreed to.
export const CONSENT_VERSION = 1;
export const CONSENT_TEXT = {
  week: 'שלחו לי במייל את בעיית השבוע ואת הצעד הבא במסלול שלי (פעם בשבוע לכל היותר)',
  return: 'אם לא אבקר באתר זמן מה, שלחו לי תזכורת להמשיך מאיפה שעצרתי (פעמיים לכל היותר)',
};

