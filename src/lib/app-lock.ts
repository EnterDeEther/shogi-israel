import { AUTH_STORAGE_KEY } from './account-config';
import { isIos } from './install';

export const APP_GATE = '/account/?app=gate';

export const gateAllows = (href: string, here: string): 'stay' | 'privacy' | 'block' => {
  const url = new URL(href, here);
  if (url.protocol === 'mailto:' || url.protocol === 'tel:') return 'stay';
  if (url.origin !== new URL(here).origin) return 'block';
  if (url.pathname === '/account/') return 'stay';
  if (url.pathname === '/privacy/') return 'privacy';
  return 'block';
};

export async function checkAppSession(): Promise<void> {
  const { supabase } = await import('./account');
  const { data, error } = await supabase().auth.getUser();
  if (data.user || !error) return;
  const status = (error as { status?: number }).status;
  if (error.name !== 'AuthSessionMissingError' && status !== 401 && status !== 403) return;
  await supabase().auth.signOut({ scope: 'local' }).catch(() => {});
  try { localStorage.removeItem(AUTH_STORAGE_KEY); } catch {}
  location.replace(APP_GATE);
}

let sheet: HTMLDialogElement | null = null;

async function openPrivacy(hash: string) {
  if (!sheet) {
    sheet = document.createElement('dialog');
    sheet.className = 'gate-sheet';
    sheet.setAttribute('aria-label', 'מדיניות הפרטיות');
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'btn btn-ghost gate-sheet-x';
    close.textContent = 'סגירה';
    close.addEventListener('click', () => sheet!.close());
    const body = document.createElement('div');
    body.className = 'gate-sheet-body';
    body.textContent = 'טוען…';
    sheet.append(close, body);
    document.body.append(sheet);
    try {
      const res = await fetch('/privacy/');
      if (!res.ok) throw new Error(String(res.status));
      const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
      const main = doc.querySelector('main');
      main?.querySelectorAll('script, style, iframe, form').forEach((el) => el.remove());
      body.replaceChildren(...(main ? [...main.childNodes] : []));
    } catch {
      body.textContent = 'צריך חיבור לאינטרנט כדי לקרוא את מדיניות הפרטיות.';
    }
  }
  sheet.showModal();
  const id = decodeURIComponent(hash.slice(1));
  const to = id ? sheet.querySelector<HTMLElement>(`[id="${CSS.escape(id)}"]`) : null;
  if (to) to.scrollIntoView({ block: 'start' });
  else sheet.querySelector('.gate-sheet-body')?.scrollTo({ top: 0 });
}

export function startGate(): void {
  document.querySelectorAll<HTMLElement>('[data-gate-ios]').forEach((el) => { el.hidden = !isIos(); });
  const offline = () => document.querySelectorAll<HTMLElement>('[data-gate-offline]').forEach((el) => { el.hidden = navigator.onLine; });
  offline();
  addEventListener('online', offline);
  addEventListener('offline', offline);
  document.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href]');
    if (!a) return;
    const verdict = gateAllows(a.href, location.href);
    if (verdict === 'stay') return;
    e.preventDefault();
    e.stopPropagation();
    if (verdict === 'privacy') void openPrivacy(new URL(a.href).hash);
  }, true);
}
