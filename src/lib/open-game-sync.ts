import { supabase, getSession } from './account';

type Mode = 'ai' | 'local';
const MODES: Mode[] = ['ai', 'local'];
const KEY: Record<Mode, string> = { ai: 'shogi-il.play.current', local: 'shogi-il.play.local.current' };

interface Slot { at: number; raw: string; data: unknown }

function readSlot(mode: Mode): Slot | null {
  try {
    const raw = localStorage.getItem(KEY[mode]);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data?.record || data.record.version !== 1) return null;
    return { at: Number(data.at) || 0, raw, data };
  } catch {
    return null;
  }
}

const sending: Partial<Record<Mode, boolean>> = {};
const again: Partial<Record<Mode, boolean>> = {};

export async function pushOpenGame(mode: Mode): Promise<void> {
  if (document.visibilityState === 'hidden') return;
  if (sending[mode]) { again[mode] = true; return; }
  sending[mode] = true;
  try {
    do {
      again[mode] = false;
      const slot = readSlot(mode);
      const session = await getSession();
      if (!slot || !session) break;
      await supabase().rpc('save_open_game', { p_mode: mode, p_data: slot.data, p_at: slot.at });
    } while (again[mode]);
  } catch {
  } finally {
    sending[mode] = false;
  }
}

export async function syncOpenGames(): Promise<Mode[]> {
  try {
    return await pull();
  } catch {
    return [];
  } finally {
    document.dispatchEvent(new CustomEvent('shogi-il:open-games-checked'));
  }
}

async function pull(): Promise<Mode[]> {
  const session = await getSession();
  if (!session) return [];
  const { data, error } = await supabase().from('open_games').select('mode, data, at').eq('user_id', session.user.id);
  if (error) return [];
  const pulled: Mode[] = [];
  for (const mode of MODES) {
    const row = (data ?? []).find((r) => r.mode === mode);
    const local = readSlot(mode);
    const remoteAt = Number(row?.at) || 0;
    if (row && remoteAt > (local?.at ?? 0) && row.data?.record?.version === 1) {
      try { localStorage.setItem(KEY[mode], JSON.stringify({ ...row.data, at: remoteAt })); } catch { continue; }
      pulled.push(mode);
    } else if (local && local.at > remoteAt) {
      void pushOpenGame(mode);
    }
  }
  if (pulled.length) document.dispatchEvent(new CustomEvent<Mode[]>('shogi-il:open-game-synced', { detail: pulled }));
  return pulled;
}

export function startOpenGameSync(): void {
  document.addEventListener('shogi-il:game-saved', (e) => {
    const mode = (e as CustomEvent<Mode>).detail;
    if (mode === 'ai' || mode === 'local') void pushOpenGame(mode);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void syncOpenGames();
  });
  void syncOpenGames();
}
