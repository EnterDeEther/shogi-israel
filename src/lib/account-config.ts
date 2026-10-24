// Is the accounts backend configured for this build? Tiny on purpose: every page imports it,
// and only pages with a signed-in visitor go on to load the Supabase client (src/lib/account.ts).
// Keys come from the Vercel ↔ Supabase integration (NEXT_PUBLIC_*) or from PUBLIC_* set by hand.
const env = import.meta.env;
export const SUPABASE_URL: string = env.PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || '';
export const SUPABASE_KEY: string =
  env.PUBLIC_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';
export const accountsEnabled = Boolean(SUPABASE_URL && SUPABASE_KEY);
/** Cloudflare Turnstile site key (public). When set, sign-up, sign-in and password reset need the bot check. */
export const TURNSTILE_SITE_KEY: string = env.PUBLIC_TURNSTILE_SITE_KEY || '';

export const AUTH_STORAGE_KEY = 'shogi-il.auth';
export function hasStoredSession(): boolean {
  try { return !!localStorage.getItem(AUTH_STORAGE_KEY); } catch { return false; }
}
