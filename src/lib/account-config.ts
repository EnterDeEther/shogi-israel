export const SUPABASE_URL: string = import.meta.env.PUBLIC_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL || '';
export const SUPABASE_KEY: string =
  import.meta.env.PUBLIC_SUPABASE_ANON_KEY ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  '';
export const accountsEnabled = Boolean(SUPABASE_URL && SUPABASE_KEY);
export const TURNSTILE_SITE_KEY: string = import.meta.env.PUBLIC_TURNSTILE_SITE_KEY || '0x4AAAAAAFleBpVksiOS6Xuk';

export const AUTH_STORAGE_KEY = 'shogi-il.auth';
export function hasStoredSession(): boolean {
  try { return !!localStorage.getItem(AUTH_STORAGE_KEY); } catch { return false; }
}
