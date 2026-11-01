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
}

const HISTORY = 'play.history';
export const CURRENT = 'play.current';
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
  return loadHistory().reduce((m, r) => (r.result?.winner === r.playerColor ? Math.max(m, r.level) : m), 0);
}

export function gameInProgress(): { moves: number; level: number } | null {
  try {
    const saved = JSON.parse(storage.get(CURRENT) || 'null') as { record?: GameRecord } | null;
    const r = saved?.record;
    if (!r || r.version !== 1 || r.result || !Array.isArray(r.moves)) return null;
    return { moves: r.moves.length, level: r.level };
  } catch {
    return null;
  }
}
