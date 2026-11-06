import { SUPABASE_KEY, SUPABASE_URL, accountsEnabled } from './account-config';
import { type AdSource, adSource, rememberAdSource } from './ad-source';

export type AdEvent = 'start' | 'win' | 'tour_skip' | 'tour_part' | 'tour_done' | 'inapp_card' | 'open_chrome';

const SENT = 'shogi-il.ad-count';

export const campaignOf = (a: AdSource | null): string | null =>
  a ? [a.source, a.medium, a.campaign].filter((v): v is string => !!v).join(' / ') : null;

type Store = Pick<Storage, 'getItem' | 'setItem'>;
type Send = (body: { p_campaign: string; p_event: AdEvent; p_level: number }) => void;

const post: Send = (body) => {
  if (!accountsEnabled) return;
  fetch(`${SUPABASE_URL}/rest/v1/rpc/count_ad_play`, {
    method: 'POST',
    keepalive: true,
    headers: { apikey: SUPABASE_KEY, authorization: `Bearer ${SUPABASE_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }).catch(() => {});
};

const session = (): Store | undefined => {
  try { return sessionStorage; } catch { return undefined; }
};

export function countAd(event: AdEvent, level = 0, deps: { source?: AdSource | null; store?: Store; send?: Send } = {}): boolean {
  const campaign = campaignOf(deps.source !== undefined ? deps.source : adSource());
  if (!campaign) return false;
  const store = deps.store ?? session();
  const key = `${event}:${level}`;
  let sent: string[] = [];
  try {
    const v = JSON.parse(store?.getItem(SENT) || '[]');
    if (Array.isArray(v)) sent = v;
  } catch { }
  if (sent.includes(key)) return false;
  try { store?.setItem(SENT, JSON.stringify([...sent, key])); } catch { }
  (deps.send ?? post)({ p_campaign: campaign, p_event: event, p_level: level });
  return true;
}

export function tourEvent(detail: { id?: string; how?: string; at?: number } | undefined): AdEvent | null {
  if (detail?.id !== 'play') return null;
  if (detail.how === 'done') return 'tour_done';
  return (detail.at ?? -1) < 0 ? 'tour_skip' : 'tour_part';
}

export function startAdCounts(): void {
  rememberAdSource();
  if (!adSource()) return;
  document.addEventListener('shogi-il:game-start', (e) => {
    const d = (e as CustomEvent<{ mode: string; level: number }>).detail;
    countAd('start', d?.mode === 'local' ? 0 : d?.level ?? 0);
  });
  document.addEventListener('shogi-il:game-end', (e) => {
    const r = (e as CustomEvent<{ mode?: string; level: number; playerColor: string; result?: { winner?: string } }>).detail;
    if (r && r.mode !== 'local' && r.result?.winner === r.playerColor) countAd('win', r.level);
  });
  document.addEventListener('tour-end', (e) => {
    const ev = tourEvent((e as CustomEvent<{ id?: string; how?: string; at?: number }>).detail);
    if (ev) countAd(ev);
  });
}
