// Is the accounts backend configured for this build? Tiny on purpose: every page imports it,
// and only pages with a signed-in visitor go on to load the Supabase client (src/lib/account.ts).
// Keys come from the Vercel ↔ Supabase integration (NEXT_PUBLIC_*) or from PUBLIC_* set by hand.
// Read each key by its full name: Vite then inlines just that value, instead of shipping every PUBLIC_* build variable.
export const SUPABASE_URL: string = import.meta.env.PUBLIC_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL || '';
export const SUPABASE_KEY: string =
  import.meta.env.PUBLIC_SUPABASE_ANON_KEY ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  '';
export const accountsEnabled = Boolean(SUPABASE_URL && SUPABASE_KEY);
/** Cloudflare Turnstile site key (public, safe to ship). With it, sign-up, sign-in and password reset need the bot check. */
export const TURNSTILE_SITE_KEY: string = import.meta.env.PUBLIC_TURNSTILE_SITE_KEY || '0x4AAAAAAFleBpVksiOS6Xuk';

export const AUTH_STORAGE_KEY = 'shogi-il.auth';
export function hasStoredSession(): boolean {
  try { return !!localStorage.getItem(AUTH_STORAGE_KEY); } catch { return false; }
}
