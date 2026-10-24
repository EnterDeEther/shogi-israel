// Accounts (Supabase): sign-in by one-time email code or Google, a public nickname,
// and progress that follows the account across devices. Without an account nothing changes:
// progress stays in this browser only.
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import { AUTH_STORAGE_KEY, SUPABASE_KEY, SUPABASE_URL } from './account-config';
import { emptyProgress, LEARN_KEY, merge, normalize, RULES_PREFIX, same, type SyncedProgress } from './progress-sync';

let client: SupabaseClient | null = null;
export function supabase(): SupabaseClient {
  client ??= createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { storageKey: AUTH_STORAGE_KEY, persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
  });
  return client;
}

export async function getSession(): Promise<Session | null> {
  const { data } = await supabase().auth.getSession();
  return data.session;
}

// ---------- sign in / out ----------
const redirectTo = () => `${window.location.origin}/account/`;

export async function sendEmailCode(email: string) {
  return supabase().auth.signInWithOtp({ email, options: { shouldCreateUser: true, emailRedirectTo: redirectTo() } });
}
export async function verifyEmailCode(email: string, token: string) {
  return supabase().auth.verifyOtp({ email, token, type: 'email' });
}
export async function signInWithGoogle() {
  return supabase().auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirectTo() } });
}
/** Signing out also clears this device's progress, so the next person on a shared device starts fresh. */
export async function signOut() {
  await supabase().auth.signOut();
  writeLocal(emptyProgress());
}
export async function deleteAccount() {
  const { error } = await supabase().rpc('delete_my_account');
  if (error) return { error };
  await signOut();
  return { error: null };
}

// ---------- nickname ----------
export interface Profile { id: string; nickname: string; rating: number }
export async function getProfile(userId: string): Promise<Profile | null> {
  const { data } = await supabase().from('profiles').select('id, nickname, rating').eq('id', userId).maybeSingle();
  return data;
}
/** Returns 'taken' when someone already has the nickname (unique, case-insensitive). */
export async function saveNickname(userId: string, nickname: string, isNew: boolean): Promise<'ok' | 'taken' | 'error'> {
  const q = isNew
    ? supabase().from('profiles').insert({ id: userId, nickname })
    : supabase().from('profiles').update({ nickname }).eq('id', userId);
  const { error } = await q;
  if (!error) return 'ok';
  return error.code === '23505' ? 'taken' : 'error';
}

// ---------- games (written by play vs AI) ----------
export async function gameSummary(): Promise<{ played: number; wins: number; losses: number; draws: number }> {
  const { data } = await supabase().from('games').select('result').neq('result', 'abort').limit(10000);
  const rows = data ?? [];
  return {
    played: rows.length,
    wins: rows.filter((r) => r.result === 'win').length,
    losses: rows.filter((r) => r.result === 'loss').length,
    draws: rows.filter((r) => r.result === 'draw').length,
  };
}

// ---------- progress ----------
export function readLocal(): SyncedProgress {
  const p = emptyProgress();
  try {
    const learn = localStorage.getItem(LEARN_KEY);
    if (learn) p.learn = normalize({ learn: JSON.parse(learn) }).learn;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(RULES_PREFIX) && localStorage.getItem(k) === '1') p.rules.push(k.slice(RULES_PREFIX.length));
    }
  } catch { /* no storage: nothing local */ }
  return normalize(p);
}

function writeLocal(p: SyncedProgress) {
  try {
    if (Object.keys(p.learn.stages).length) localStorage.setItem(LEARN_KEY, JSON.stringify(p.learn));
    else localStorage.removeItem(LEARN_KEY);
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith(RULES_PREFIX) && !p.rules.includes(k.slice(RULES_PREFIX.length))) localStorage.removeItem(k);
    }
    for (const id of p.rules) localStorage.setItem(RULES_PREFIX + id, '1');
  } catch { /* fine */ }
}

/** Pull the account's progress, merge it with this device's, and save the union on both sides. */
export async function syncProgress(): Promise<SyncedProgress | null> {
  const session = await getSession();
  if (!session) return null;
  const db = supabase();
  const { data, error } = await db.from('progress').select('data').eq('user_id', session.user.id).maybeSingle();
  if (error) return null;
  const local = readLocal();
  const remote = normalize(data?.data);
  const merged = merge(local, remote);
  if (!same(merged, local)) {
    writeLocal(merged);
    document.dispatchEvent(new CustomEvent('progress-synced'));
  }
  if (!data || !same(merged, remote)) {
    await db.from('progress').upsert({ user_id: session.user.id, data: merged, updated_at: new Date().toISOString() });
  }
  return merged;
}

async function pushLocal() {
  const session = await getSession();
  if (session) await supabase().from('progress').upsert({ user_id: session.user.id, data: readLocal(), updated_at: new Date().toISOString() });
}

/** Runs on every page for signed-in visitors: sync now, then after each saved score or finished lesson. */
export function startSync() {
  let timer: number | undefined;
  const later = () => { clearTimeout(timer); timer = window.setTimeout(() => void syncProgress(), 1500); };
  document.addEventListener('progress-changed', later);
  // "reset my progress" in the lessons: overwrite the account's copy instead of merging it back
  document.addEventListener('progress-reset', () => void pushLocal());
  window.addEventListener('pagehide', () => { if (timer) void syncProgress(); });
  void syncProgress();
}
