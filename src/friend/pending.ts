// AGPL-3.0-or-later, like the rest of this site.
const PENDING = 'shogi-il.friend.pending';
export function rememberInvite(code: string | null): void {
  try { if (code) localStorage.setItem(PENDING, JSON.stringify({ code, at: Date.now() })); else localStorage.removeItem(PENDING); } catch { }
}
export function rememberedInvite(maxAgeMs = 864e5): string | null {
  try {
    const v = JSON.parse(localStorage.getItem(PENDING) || 'null');
    return v && typeof v.code === 'string' && /^[a-z0-9]{10}$/.test(v.code) && Date.now() - v.at < maxAgeMs ? v.code : null;
  } catch {
    return null;
  }
}
