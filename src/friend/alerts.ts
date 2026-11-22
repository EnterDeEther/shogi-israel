// AGPL-3.0-or-later, like the rest of this site.
import type { Gender } from '../lib/gender.js';
import { layout, SITE, type Email } from '../lib/notify.js';
import type { PushMessage } from '../lib/push.js';

export const TURN_MAIL_GAP_MS = 24 * 3600 * 1000;
export const ASK_ALERT_GAP_MS = 30 * 60 * 1000;
export type AlertKind = 'turn' | 'end' | 'ask' | 'soon';

const WHEN = new Intl.DateTimeFormat('he-IL', { timeZone: 'Asia/Jerusalem', weekday: 'long', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const until = (deadline?: number | null): string => (deadline ? `יש לך זמן עד ${WHEN.format(new Date(deadline))}.` : '');

const PUSH_TEXT: Record<AlertKind, (opp: string, deadline?: number | null) => [string, string]> = {
  turn: (opp) => [`תורך במשחק נגד ${opp}`, 'הלוח מחכה למהלך שלך.'],
  end: (opp) => [`המשחק נגד ${opp} הסתיים`, 'אפשר לראות איך הוא נגמר ולהציע עוד משחק.'],
  ask: (opp) => [`בקשה מ${opp} במשחק שלכם`, 'הבקשה מחכה לתשובה שלך.'],
  soon: (opp, deadline) => [`הזמן למהלך שלך נגד ${opp} עומד להיגמר`, until(deadline) || 'הלוח מחכה למהלך שלך.'],
};

export const gamePush = (kind: AlertKind, opp: string, id: string, deadline?: number | null): PushMessage => {
  const [title, body] = PUSH_TEXT[kind](opp, deadline);
  return { title, body, url: `/friend/game/#${id}`, tag: `friend-${id}` };
};

export const turnPush = (opp: string, id: string): PushMessage => gamePush('turn', opp, id);

interface MailInput { nickname: string; opp: string; id: string; deadline: number | null; gender: Gender; unsubscribeUrl: string }

export function gameEmail(kind: AlertKind, input: MailInput): Email {
  const left = input.deadline ? ` ${until(input.deadline)}` : '';
  const text: Record<AlertKind, string> = {
    turn: `יש מהלך חדש מ${input.opp} במשחק שלכם, ועכשיו תורך.${left}`,
    end: `המשחק שלך נגד ${input.opp} הסתיים. בעמוד המשחק אפשר לראות איך הוא נגמר, לעבור על המהלכים ולהציע עוד משחק.`,
    ask: `יש בקשה מ${input.opp} במשחק שלכם, והיא מחכה לתשובה שלך.`,
    soon: `עדיין תורך במשחק נגד ${input.opp}, והזמן למהלך עומד להיגמר.${left} בלי מהלך עד אז, המשחק יסתיים.`,
  };
  return layout({
    subject: PUSH_TEXT[kind](input.opp, input.deadline)[0],
    nickname: input.nickname,
    gender: input.gender,
    unsubscribeUrl: input.unsubscribeUrl,
    blocks: [{
      text: text[kind],
      href: `${SITE}/friend/game/?utm_source=email&utm_medium=email&utm_campaign=${kind === 'turn' ? 'turn' : `game-${kind}`}#${input.id}`,
      cta: 'למשחק',
    }],
    why: 'קיבלת את המייל הזה כי ביקשת מיילים על המשחקים שלך עם חברים. על כל משחק נשלח לכל היותר מייל אחד ביום.',
  });
}

export const turnEmail = (input: MailInput): Email => gameEmail('turn', input);
