import { accountsEnabled, hasStoredSession } from './account-config';
import { currentGender } from './gender';
import { isStandalone } from './install';
import { PUSH_KINDS, type PushKinds } from './push';

const KINDS = 'shogi-il.push.kinds';
const SYNCED = 'shogi-il.push.synced';
const OFFER = 'shogi-il.push.offer';
const RESYNC_DAYS = 1;

export const NO_KINDS: PushKinds = Object.fromEntries(PUSH_KINDS.map((k) => [k, false])) as PushKinds;

const get = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const set = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch {} };
const del = (k: string) => { try { localStorage.removeItem(k); } catch {} };

export const pushSupported = (): boolean => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

export const pushHere = (): boolean => isStandalone() && pushSupported();

export const permission = (): NotificationPermission => (pushSupported() ? Notification.permission : 'denied');

let keyPromise: Promise<string | null> | null = null;
export function serverKey(): Promise<string | null> {
  keyPromise ??= fetch('/api/push').then(async (r) => (r.ok ? ((await r.json()) as { key?: string }).key ?? null : null)).catch(() => null);
  return keyPromise;
}

const urlB64 = (s: string) => {
  const b = atob((s + '='.repeat((4 - (s.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
};

async function subscription(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

export async function currentKinds(): Promise<PushKinds> {
  if (!pushSupported() || permission() !== 'granted') return { ...NO_KINDS };
  try {
    if (!(await subscription())) return { ...NO_KINDS };
    const saved = JSON.parse(get(KINDS) || 'null') as Partial<PushKinds> | null;
    return { ...NO_KINDS, ...saved };
  } catch { return { ...NO_KINDS }; }
}

async function token(): Promise<string | undefined> {
  if (!signedIn()) return undefined;
  try { return (await (await import('./account')).getSession())?.access_token; } catch { return undefined; }
}

export type SaveResult = 'ok' | 'denied' | 'unavailable' | 'error';

export async function saveKinds(kinds: PushKinds): Promise<SaveResult> {
  if (!pushSupported()) return 'unavailable';
  const any = PUSH_KINDS.some((k) => kinds[k]);
  try {
    if (!any) {
      const sub = await subscription();
      if (sub) {
        await fetch('/api/push', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => {});
        await sub.unsubscribe().catch(() => {});
      }
      del(KINDS); del(SYNCED);
      return 'ok';
    }
    if (permission() !== 'granted' && (await Notification.requestPermission()) !== 'granted') return 'denied';
    const key = await serverKey();
    if (!key) return 'unavailable';
    const reg = await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64(key) }));
    const res = await fetch('/api/push', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription: sub.toJSON(), kinds, gender: currentGender(), token: await token() }),
    });
    if (!res.ok) return 'error';
    const saved = ((await res.json()) as { kinds?: PushKinds }).kinds ?? kinds;
    set(KINDS, JSON.stringify(saved));
    set(SYNCED, `${Date.now()}|${signedIn() ? 1 : 0}`);
    set(OFFER, 'seen');
    return 'ok';
  } catch (e) {
    console.warn('push: save failed', e);
    return 'error';
  }
}

const signedIn = () => accountsEnabled && hasStoredSession();

export async function resync(): Promise<void> {
  if (!pushHere()) return;
  const [at, was] = (get(SYNCED) || '0|0').split('|');
  if (Date.now() - Number(at) < RESYNC_DAYS * 864e5 && was === (signedIn() ? '1' : '0')) return;
  const kinds = await currentKinds();
  if (PUSH_KINDS.some((k) => kinds[k])) await saveKinds(kinds);
}

export const offerWanted = (): boolean => pushHere() && get(OFFER) !== 'seen' && permission() === 'default';
export const offerSeen = () => set(OFFER, 'seen');
