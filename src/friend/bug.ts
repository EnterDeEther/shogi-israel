// AGPL-3.0-or-later, like the rest of this site.
import { el } from '../learn/view';
import { CONTACT_EMAIL } from '../lib/contact';
import { call } from './client';

export interface BugContext {
  id?: string;
  code?: string;
  context?: string;
}

let current: () => BugContext = () => ({});

export function setBugContext(fn: () => BugContext): void {
  current = fn;
}

export function openBug(): void {
  const box = document.querySelector<HTMLDetailsElement>('[data-friend-bug]');
  if (!box) return;
  box.open = true;
  box.querySelector<HTMLElement>('button')?.focus({ preventScroll: true });
  const r = box.getBoundingClientRect();
  const fits = r.height + 24 <= window.innerHeight;
  const top = fits ? r.bottom + window.scrollY - window.innerHeight + 12 : r.top + window.scrollY - 12;
  if (!fits || r.top < 0 || r.bottom > window.innerHeight) window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
}

const KINDS: [string, string][] = [
  ['move', 'מהלך לא נשלח או חזר אחורה'],
  ['sync', 'הלוח לא התעדכן'],
  ['join', 'לא הצלחתי להיכנס למשחק'],
  ['link', 'הקישור לא עבד'],
  ['alert', 'לא קיבלתי התראה'],
  ['other', 'משהו אחר'],
];

export function mountBug(box: HTMLElement): void {
  let kind = '';
  const chips = el('div', { class: 'friend-chips', role: 'group', 'aria-label': 'מה לא עבד?' });
  const note = el('textarea', { id: 'friend-bug-note', rows: '3', maxlength: '500' }) as HTMLTextAreaElement;
  const send = el('button', { type: 'button', class: 'btn' }, 'שליחה') as HTMLButtonElement;
  const status = el('p', { class: 'friend-msg', role: 'status' });
  const mail = () => el('a', { href: `mailto:${CONTACT_EMAIL}`, dir: 'ltr' }, CONTACT_EMAIL);
  for (const [key, label] of KINDS) {
    chips.append(el('button', {
      type: 'button', class: 'choice', 'aria-pressed': 'false',
      onclick: (e: Event) => {
        kind = key;
        chips.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget)));
        status.textContent = '';
      },
    }, label));
  }
  send.addEventListener('click', async () => {
    if (!kind) {
      status.textContent = '⟦בחר|בחרי⟧ קודם מה לא עבד.';
      return;
    }
    const c = current();
    const context = [`page=${location.pathname}`, `online=${navigator.onLine}`, `screen=${window.innerWidth}x${window.innerHeight}`, c.context ?? ''].join(' ').trim();
    send.disabled = true;
    status.textContent = 'שולחים…';
    const r = await call('bug', { ...(c.id ? { id: c.id } : {}), ...(c.code ? { code: c.code } : {}), kind, note: note.value, context });
    send.disabled = false;
    if (r.ok) {
      note.value = '';
      status.textContent = 'תודה, קיבלנו. נבדוק את זה.';
      return;
    }
    status.replaceChildren('השליחה לא הצליחה. אפשר לכתוב לנו במייל: ', mail());
  });
  box.append(
    el('p', {}, 'מה לא עבד?'),
    chips,
    el('label', { for: 'friend-bug-note' }, 'מה קרה? (לא חובה)'),
    note,
    el('p', { class: 'small muted' }, 'הדיווח נשלח אלינו עם פרטי המשחק וסוג הדפדפן, בלי שם ובלי מייל. רוצה תשובה? אפשר לכתוב לנו: ', mail()),
    send,
    status,
  );
}
