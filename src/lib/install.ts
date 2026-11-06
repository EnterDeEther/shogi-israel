export type InstallWay = 'installed' | 'prompt' | 'ios' | 'ios-chrome' | 'ios-inapp' | 'android-inapp' | 'android-menu' | 'none';

interface PromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const INSTALLED = 'shogi-il.app.installed';
const LATER = 'shogi-il.app.later';
const CLOSED = 'shogi-il.app.closed';
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
export const isIpad = () => /iPad/.test(ua()) || (/Macintosh/.test(ua()) && navigator.maxTouchPoints > 1);
export const isIos = () => /iPhone|iPad|iPod/.test(ua()) || (/Macintosh/.test(ua()) && navigator.maxTouchPoints > 1);
export const isAndroid = () => /Android/.test(ua());
const isIosOther = () => /CriOS|EdgiOS|FxiOS/.test(ua());
export const isInApp = () => /Instagram|FBAN|FBAV|FB_IAB|FBIOS|Line\/|MicroMessenger|TikTok|musical_ly|Snapchat/i.test(ua());

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

export const closeOffer = () => set(CLOSED, '1');
const resting = () => Date.now() - Number(get(LATER) || 0) < LATER_DAYS * 864e5;

const views = () => Number(get(VIEWS) || 0);
const touch = () => matchMedia('(pointer: coarse)').matches;
const offerable = (way: InstallWay) => way !== 'installed' && way !== 'none';

export function offerOnPage(path: string): boolean {
  if (/^\/(try|play|kif|clock)(\/|$)/.test(path)) return false;
  return !/^\/(learn|rules|tsume)\/.+/.test(path);
}

export function offerWanted(): boolean {
  if (get(CLOSED) || resting() || views() < 2) return false;
  return touch() && offerable(installWay());
}

export const miniWanted = (): boolean => touch() && offerable(installWay());

let asking: Promise<boolean> | null = null;
export function confirmInstall(): Promise<boolean> {
  const box = document.querySelector<HTMLDialogElement>('[data-install-warning]');
  if (!box || typeof box.showModal !== 'function') return Promise.resolve(true);
  if (asking) return asking;
  box.querySelectorAll<HTMLElement>('[data-warn-ios]').forEach((el) => { el.hidden = !isIos(); });
  box.querySelectorAll<HTMLElement>('[data-warn-android-in]').forEach((el) => {
    el.hidden = !(isAndroid() && document.documentElement.hasAttribute('data-signed-in'));
  });
  asking = new Promise<boolean>((resolve) => {
    box.returnValue = '';
    box.addEventListener('close', () => { asking = null; resolve(box.returnValue === 'go'); }, { once: true });
    box.showModal();
  });
  return asking;
}

function toast(text: string) {
  const el = document.createElement('div');
  el.className = 'xp-toast xp-toast--guest';
  el.setAttribute('role', 'status');
  el.textContent = text;
  document.body.append(el);
  requestAnimationFrame(() => el.classList.add('xp-toast--on'));
  setTimeout(() => { el.classList.remove('xp-toast--on'); setTimeout(() => el.remove(), 400); }, 6000);
}

export async function installFlow(installedText: string): Promise<boolean> {
  if (!(await confirmInstall())) return false;
  const menu = document.querySelector<HTMLDetailsElement>('[data-nav-narrow]');
  if (menu) menu.open = false;
  if (installWay() === 'prompt') {
    const ok = await promptInstall();
    if (ok) toast(installedText);
    return ok;
  }
  if (location.pathname === '/app/') {
    history.replaceState(history.state, '', '/app/#install');
    document.getElementById('install')?.scrollIntoView({ block: 'start' });
  } else {
    location.href = '/app/#install';
  }
  return false;
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
