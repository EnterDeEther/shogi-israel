// AGPL-3.0-or-later, like the rest of this site.
import { storage } from '../learn/storage';
import type { GameEnd } from './game';

export interface ClockSetting {
  limit: number;
  byoyomi: number;
}

export interface GameRecord {
  id: string;
  version: 1;
  startedAt: string;
  endedAt?: string;
  startSfen: string;
  moves: string[];
  playerColor: Color;
  level: number;
  engine: string;
  clock: ClockSetting | null;
  takebacks: number;
  result?: GameEnd;
  /** 'local' = two players on one device (no computer). Missing = against the computer. */
  mode?: PlayMode;
}

export type PlayMode = 'ai' | 'local';
export const isLocal = (r: Pick<GameRecord, 'mode'> | undefined | null): boolean => r?.mode === 'local';

const HISTORY = 'play.history';
export const CURRENT = 'play.current';
/** A two-player game on one device has its own slot, so it never replaces a game against the computer. */
export const CURRENT_LOCAL = 'play.local.current';
export const slotKey = (mode: PlayMode): string => (mode === 'local' ? CURRENT_LOCAL : CURRENT);
const MAX_HISTORY = 100;

export const newGameId = (): string => Math.random().toString(36).slice(2, 10);

export function loadHistory(): GameRecord[] {
  try {
    const list = JSON.parse(storage.get(HISTORY) || '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function saveFinished(record: GameRecord): void {
  const list = loadHistory().filter((r) => r.id !== record.id);
  list.unshift(record);
  storage.set(HISTORY, JSON.stringify(list.slice(0, MAX_HISTORY)));
  document.dispatchEvent(new CustomEvent<GameRecord>('shogi-il:game-end', { detail: record }));
}

export function highestBeaten(): number {
  return loadHistory().reduce((m, r) => (!isLocal(r) && r.result?.winner === r.playerColor ? Math.max(m, r.level) : m), 0);
}

export interface OpenGameInfo {
  moves: number;
  level: number;
  mode: PlayMode;
  at: number;
}

/** The unfinished game saved in one slot, if any. */
export function savedGame(mode: PlayMode): OpenGameInfo | null {
  try {
    const saved = JSON.parse(storage.get(slotKey(mode)) || 'null') as { record?: GameRecord; at?: number } | null;
    const r = saved?.record;
    if (!r || r.version !== 1 || r.result || !Array.isArray(r.moves)) return null;
    return { moves: r.moves.length, level: r.level, mode, at: saved?.at ?? 0 };
  } catch {
    return null;
  }
}

/** Phones and tablets: the only devices that offer two players on one board (Dean, 2 Nov 2026). */
export const touchDevice = (): boolean => {
  try {
    return matchMedia('(hover: none) and (pointer: coarse)').matches;
  } catch {
    return false;
  }
};

/** The game the header's play button continues: the most recently played of the two slots
 *  (the two-player slot only on phones and tablets). */
export function gameInProgress(touch = touchDevice()): OpenGameInfo | null {
  const ai = savedGame('ai');
  const local = touch ? savedGame('local') : null;
  if (ai && local) return local.at > ai.at ? local : ai;
  return ai ?? local;
}

/** Header, app and menu text for a saved game. */
export function openGameText(g: OpenGameInfo): string {
  const when = !g.moves ? 'לפני המהלך הראשון' : g.moves === 1 ? 'אחרי מהלך אחד' : `אחרי ${g.moves} מהלכים`;
  return g.mode === 'local' ? `שני שחקנים, ${when}` : `רמה ${g.level}, ${when}`;
}
