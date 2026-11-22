// AGPL-3.0-or-later, like the rest of this site.
import { rememberedInvite } from './pending';

export function friendReturnBar(): void {
  const code = rememberedInvite(7 * 864e5);
  const host = document.querySelector('main .wrap') ?? document.querySelector('.wrap');
  if (!code || !host) return;
  const link = document.createElement('a');
  link.href = `/friend/#${code}`;
  link.textContent = 'חזרה להזמנה';
  link.style.fontWeight = '700';
  const bar = document.createElement('p');
  bar.setAttribute('role', 'note');
  bar.style.cssText = 'margin:0 0 14px;padding:10px 14px;border:1px solid var(--seal);border-radius:10px;background:var(--washi-2);font-size:15px;';
  bar.append('ההזמנה למשחק עם חבר מחכה לך. ', link);
  host.prepend(bar);
}
