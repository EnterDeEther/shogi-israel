export const ACTIVITY_KEYS = ['shogi-il.learn.progress', 'shogi-il.tsume.solved', 'shogi-il.play.history'] as const;
export const OPEN_GAME_KEYS = ['shogi-il.play.current', 'shogi-il.play.local.current'] as const;
export const RULES_DONE_PREFIX = 'done:';

export interface KeyStore {
  getItem(key: string): string | null;
  key(index: number): string | null;
  readonly length: number;
}

const filled = (v: string | null): boolean => !!v && v !== '[]' && v !== '{}';

const openGame = (v: string | null): boolean => {
  try {
    const r = JSON.parse(v || 'null')?.record;
    return !!r && r.version === 1 && !r.result && Array.isArray(r.moves);
  } catch {
    return false;
  }
};

export function hasActivity(ls: KeyStore): boolean {
  try {
    if (ACTIVITY_KEYS.some((k) => filled(ls.getItem(k)))) return true;
    if (OPEN_GAME_KEYS.some((k) => openGame(ls.getItem(k)))) return true;
    for (let i = 0; i < ls.length; i++) if ((ls.key(i) || '').startsWith(RULES_DONE_PREFIX)) return true;
  } catch { }
  return false;
}

export function isReturning(ls: KeyStore, authKey = ''): boolean {
  try {
    if (authKey && ls.getItem(authKey)) return true;
  } catch { }
  return hasActivity(ls);
}

export const RETURNING_GUESS = `try {
  const ls = localStorage;
  const auth = document.currentScript.dataset.auth;
  const filled = (v) => !!v && v !== '[]' && v !== '{}';
  const open = (v) => { try { const r = JSON.parse(v || 'null')?.record; return !!r && r.version === 1 && !r.result && Array.isArray(r.moves); } catch { return false; } };
  let on = !!(auth && ls.getItem(auth)) || ${JSON.stringify(ACTIVITY_KEYS)}.some((k) => filled(ls.getItem(k))) || ${JSON.stringify(OPEN_GAME_KEYS)}.some((k) => open(ls.getItem(k)));
  for (let i = 0; !on && i < ls.length; i++) on = (ls.key(i) || '').startsWith(${JSON.stringify(RULES_DONE_PREFIX)});
  if (on) document.documentElement.setAttribute('data-learner', '');
} catch {}`;
