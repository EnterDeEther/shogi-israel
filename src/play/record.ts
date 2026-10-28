// Shogi Israel: what a game against the computer leaves behind, on this device only (no accounts yet).
// Hooks for the work that comes next:
//   - accounts, stats and leaderboards: finished games are kept in localStorage ('play.history') and announced
//     with a 'shogi-il:game-end' event on document, detail = the GameRecord. A sync step can read both.
//   - KIF export: a GameRecord has everything a KIF file needs (start position, moves, players, result, dates);
//     the end-of-game panel has an empty [data-hook="export"] slot for the button.
// AGPL-3.0-or-later, like the rest of this site.
import { storage } from '../learn/storage';
import type { GameEnd } from './game';

export interface ClockSetting {
  limit: number; // main time per side, seconds
  byoyomi: number; // seconds per move once the main time is used up
}

export interface GameRecord {
  id: string;
  version: 1;
  startedAt: string; // ISO
  endedAt?: string;
  startSfen: string;
  moves: string[]; // USI
  playerColor: Color;
  level: number;
  engine: string;
  clock: ClockSetting | null;
  takebacks: number;
  result?: GameEnd;
}

const HISTORY = 'play.history';
/** The game in progress (src/play/ctrl.ts saves it after every move, so a reload or another page continues it). */
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

/** Store a finished game and tell anyone listening. */
export function saveFinished(record: GameRecord): void {
  const list = loadHistory().filter((r) => r.id !== record.id);
  list.unshift(record);
  storage.set(HISTORY, JSON.stringify(list.slice(0, MAX_HISTORY)));
  document.dispatchEvent(new CustomEvent<GameRecord>('shogi-il:game-end', { detail: record }));
}

/** Highest level this device has beaten (with or without takebacks). */
export function highestBeaten(): number {
  return loadHistory().reduce((m, r) => (r.result?.winner === r.playerColor ? Math.max(m, r.level) : m), 0);
}

/** The saved game, if one is still being played: the header's play button continues it instead of starting a new one. */
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
