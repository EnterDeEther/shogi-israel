// The site as an app on the phone's home screen. The app opens on /app/ (public/manifest.webmanifest) and
// public/sw.js keeps the pages already opened for when there is no connection.
//
// How each phone installs it:
// - Android (Chrome, Edge, Samsung Internet): the browser fires 'beforeinstallprompt'; we keep it and our own
//   "התקנה" button calls prompt(), which shows the system's install dialog.
// - iPhone and iPad: there is no install API. Safari (and Chrome on iOS) add a page through Share → Add to Home
//   Screen, and the home-screen icon opens the page it was added from, so the guide lives on /app/ itself.
// - Inside Instagram, Facebook and the like there is no way to install: the guide says to open the page in the browser first.
// The offer (src/components/InstallOffer.astro) and /app/ both read this module.

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

/** Opened from the home-screen icon (not in a browser tab). */
export const isStandalone = (): boolean =>
  matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

const ua = () => navigator.userAgent;
// iPadOS presents itself as a Mac; a touch screen gives it away
const isIos = () => /iPhone|iPad|iPod/.test(ua()) || (/Macintosh/.test(ua()) && navigator.maxTouchPoints > 1);
const isAndroid = () => /Android/.test(ua());
// Chrome, Edge and Firefox on an iPhone: the share button sits in the address bar at the top, not where Safari keeps it
const isIosOther = () => /CriOS|EdgiOS|FxiOS/.test(ua());
const isInApp = () => /Instagram|FBAN|FBAV|FB_IAB|FBIOS|Line\/|MicroMessenger|TikTok|musical_ly|Snapchat/i.test(ua());

/** How this visitor can install the app right now. */
export function installWay(): InstallWay {
  if (isStandalone()) return 'installed';
  if (deferred) return 'prompt'; // the browser knows it is not installed (or was removed again)
  if (get(INSTALLED)) return 'installed';
  if (isIos()) return isInApp() ? 'ios-inapp' : isIosOther() ? 'ios-chrome' : 'ios';
  if (isAndroid()) return isInApp() ? 'android-inapp' : 'android-menu';
  return 'none';
}

/** Shows the system install dialog (Android, and Chrome / Edge on a computer). True when the visitor said yes. */
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

/** Called when anything here changes (the browser offered the install, the app got installed). */
export const onInstallChange = (f: () => void) => listeners.add(f);

/** "Not now": the offer stays away for three weeks. */
export const later = () => set(LATER, String(Date.now()));
const resting = () => Date.now() - Number(get(LATER) || 0) < LATER_DAYS * 864e5;

/** Pages seen on this device, so the offer never greets someone on the first page they open. */
const views = () => Number(get(VIEWS) || 0);

/** Should the small install offer show on this page? Phones and tablets only, from the second page on. */
export function offerWanted(): boolean {
  if (resting() || views() < 2) return false;
  if (!matchMedia('(pointer: coarse)').matches) return false;
  const way = installWay();
  // Android's own browser menu works without our help, but only the real prompt is worth interrupting for
  return way === 'prompt' || way === 'ios' || way === 'ios-chrome' || way === 'ios-inapp';
}

/** On every page (Base.astro): keep the browser's install offer, register the service worker, count the page. */
export function startInstall() {
  set(VIEWS, String(views() + 1));
  addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // our own button asks, not the browser's mini bar
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
    // in the app the logo leads back to the app's own start page, not to the site's home page
    document.documentElement.setAttribute('data-standalone', '');
    document.querySelectorAll<HTMLAnchorElement>('a.brand').forEach((a) => { a.href = '/app/'; });
  }
  if ('serviceWorker' in navigator) {
    const register = () => { navigator.serviceWorker.register('/sw.js').catch(() => {}); };
    if (document.readyState === 'complete') register(); else addEventListener('load', register);
  }
}
