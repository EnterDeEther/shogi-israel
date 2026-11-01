export type InstallWay = 'installed' | 'prompt' | 'ios' | 'ios-chrome' | 'ios-inapp' | 'android-inapp' | 'android-menu' | 'none';

interface PromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const INSTALLED = 'shogi-il.app.installed';
const LATER = 'shogi-il.app.later';
const VIEWS = 'shogi-il.app.views';
const LATER_DAYS = 21;

let deferred: PromptEvent | null = null;
const listeners = new Set<() => void>();
const changed = () => listeners.forEach((f) => f());

const get = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const set = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch {} };

export const isStandalone = (): boolean =>
  matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

const ua = () => navigator.userAgent;
export const isIos = () => /iPhone|iPad|iPod/.test(ua()) || (/Macintosh/.test(ua()) && navigator.maxTouchPoints > 1);
const isAndroid = () => /Android/.test(ua());
const isIosOther = () => /CriOS|EdgiOS|FxiOS/.test(ua());
const isInApp = () => /Instagram|FBAN|FBAV|FB_IAB|FBIOS|Line\/|MicroMessenger|TikTok|musical_ly|Snapchat/i.test(ua());

export function installWay(): InstallWay {
  if (isStandalone()) return 'installed';
  if (deferred) return 'prompt';
  if (get(INSTALLED)) return 'installed';
  if (isIos()) return isInApp() ? 'ios-inapp' : isIosOther() ? 'ios-chrome' : 'ios';
  if (isAndroid()) return isInApp() ? 'android-inapp' : 'android-menu';
  return 'none';
}

export async function promptInstall(): Promise<boolean> {
  const e = deferred;
  if (!e) return false;
  deferred = null;
  await e.prompt();
  const { outcome } = await e.userChoice;
  if (outcome === 'accepted') set(INSTALLED, '1');
  changed();
  return outcome === 'accepted';
}

export const onInstallChange = (f: () => void) => listeners.add(f);

export const later = () => set(LATER, String(Date.now()));
const resting = () => Date.now() - Number(get(LATER) || 0) < LATER_DAYS * 864e5;

const views = () => Number(get(VIEWS) || 0);

export function offerWanted(): boolean {
  if (resting() || views() < 2) return false;
  if (!matchMedia('(pointer: coarse)').matches) return false;
  const way = installWay();
  return way === 'prompt' || way === 'ios' || way === 'ios-chrome' || way === 'ios-inapp';
}

export function startInstall() {
  set(VIEWS, String(views() + 1));
  addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as PromptEvent;
    try { localStorage.removeItem(INSTALLED); } catch {}
    changed();
  });
  addEventListener('appinstalled', () => {
    deferred = null;
    set(INSTALLED, '1');
    changed();
  });
  if (isStandalone()) {
    document.documentElement.setAttribute('data-standalone', '');
    document.querySelectorAll<HTMLAnchorElement>('a.brand').forEach((a) => { a.href = '/app/'; });
  }
  if ('serviceWorker' in navigator) {
    const register = () => { navigator.serviceWorker.register('/sw.js').catch(() => {}); };
    if (document.readyState === 'complete') register(); else addEventListener('load', register);
  }
}
