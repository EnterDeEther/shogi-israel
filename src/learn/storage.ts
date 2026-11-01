// AGPL-3.0-or-later, like the rest of src/learn/.
const PREFIX = 'shogi-il.';

export const storage = {
  get(key: string): string | null {
    try { return window.localStorage.getItem(PREFIX + key); } catch { return null; }
  },
  set(key: string, value: string): void {
    try { window.localStorage.setItem(PREFIX + key, value); } catch { }
  },
  remove(key: string): void {
    try { window.localStorage.removeItem(PREFIX + key); } catch { }
  },
};
