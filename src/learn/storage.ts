// Shogi Israel: stand-in for window.lishogi.storage. localStorage can be missing or throw
// (private mode, in-app browsers): every call is guarded and the lesson works without it.
// AGPL-3.0-or-later, like the rest of src/learn/.
const PREFIX = 'shogi-il.';

export const storage = {
  get(key: string): string | null {
    try { return window.localStorage.getItem(PREFIX + key); } catch { return null; }
  },
  set(key: string, value: string): void {
    try { window.localStorage.setItem(PREFIX + key, value); } catch { /* not saved; fine */ }
  },
  remove(key: string): void {
    try { window.localStorage.removeItem(PREFIX + key); } catch { /* ignore */ }
  },
};
