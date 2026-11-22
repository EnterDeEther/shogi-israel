// AGPL-3.0-or-later, like the rest of this site.
import type { Gender } from '../lib/gender.js';
import { layout, SITE, type Email } from '../lib/notify.js';
import type { PushMessage } from '../lib/push.js';

export const TURN_MAIL_GAP_MS = 24 * 3600 * 1000;

export const turnPush = (opp: string, id: string): PushMessage => ({
  title: `תורך במשחק נגד ${opp}`,
  body: 'הלוח מחכה למהלך שלך.',
  url: `/friend/game/#${id}`,
  tag: `friend-${id}`,
});

const WHEN = new Intl.DateTimeFormat('he-IL', { timeZone: 'Asia/Jerusalem', weekday: 'long', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

export function turnEmail(input: { nickname: string; opp: string; id: string; deadline: number | null; gender: Gender; unsubscribeUrl: string }): Email {
  const until = input.deadline ? ` יש לך זמן עד ${WHEN.format(new Date(input.deadline))}.` : '';
  return layout({
    subject: `תורך במשחק נגד ${input.opp}`,
    nickname: input.nickname,
    gender: input.gender,
    unsubscribeUrl: input.unsubscribeUrl,
    blocks: [{
      text: `${input.opp} שיחק מהלך במשחק שלכם, ועכשיו תורך.${until}`,
      href: `${SITE}/friend/game/?utm_source=email&utm_medium=email&utm_campaign=turn#${input.id}`,
      cta: 'למשחק',
    }],
    why: 'קיבלת את המייל כי ביקשת מייל כשמגיע תורך במשחק עם חבר. על כל משחק נשלח מייל אחד ביום לכל היותר.',
  });
}
