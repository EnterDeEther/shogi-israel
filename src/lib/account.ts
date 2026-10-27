// Accounts (Supabase): sign-in by email and password (no Google/SSO), a public nickname,
// and progress that follows the account across devices. Without an account nothing changes:
// progress stays in this browser only.
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import { AUTH_STORAGE_KEY, SUPABASE_KEY, SUPABASE_URL } from './account-config';
import type { GameRecord } from '../play/record';
import { emptyProgress, gameResult, merge, normalize, same, type SyncedProgress } from './progress-sync';
import { readLocal, writeLocal } from './progress-local';
import { CONSENT_VERSION } from './consent';
import { adSource } from './ad-source';
import { applyGender, savedGender, type Gender } from './gender';

export { readLocal };

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

// ---------- sign in / out (email + password) ----------
const redirectTo = () => `${window.location.origin}/account/`;

/** weeklyEmail: the unticked "send me the puzzle of the week" box on the form. It is applied on the first
 * sign-in (applySignupConsent), which may be on another device, so it travels with the account.
 * gender: how the site speaks to them (lib/gender.ts), chosen on the form.
 * ad_source: the ad this tab arrived from, if any (src/lib/ad-source.ts), kept on the account. */
export async function signUp(email: string, password: string, captchaToken?: string, weeklyEmail = false, gender?: Gender) {
  const ad = adSource();
  const data = { ...(weeklyEmail ? { email_week_opt_in: CONSENT_VERSION } : {}), ...(gender ? { gender } : {}), ...(ad ? { ad_source: ad } : {}) };
  return supabase().auth.signUp({ email, password, options: { emailRedirectTo: redirectTo(), captchaToken, data } });
}
export async function signIn(email: string, password: string, captchaToken?: string) {
  return supabase().auth.signInWithPassword({ email, password, options: { captchaToken } });
}
/** The code from the sign-up email (template: supabase/templates/confirm-signup.html), typed on /account/. */
export async function verifySignupCode(email: string, token: string) {
  return supabase().auth.verifyOtp({ email, token, type: 'email' });
}
/** Emails a link back to /account/, which opens the "new password" form (PASSWORD_RECOVERY). */
export async function sendPasswordReset(email: string, captchaToken?: string) {
  return supabase().auth.resetPasswordForEmail(email, { redirectTo: redirectTo(), captchaToken });
}
/** Settles within ms: a request the network never answers becomes an error the form can show, not a dead button. */
export function timed<T>(p: Promise<T>, ms = 20000): Promise<T> {
  return Promise.race([p, new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);
}
/** nonce: the code from reauthenticate(), when Supabase asks for one (secure password change). */
export async function setPassword(password: string, nonce?: string) {
  return timed(supabase().auth.updateUser(nonce ? { password, nonce } : { password }));
}
/** Emails a code that confirms it's really them, for setPassword's nonce. */
export async function reauthenticate() {
  return timed(supabase().auth.reauthenticate());
}
/** The address changes once the link sent to it is opened (with "secure email change", the old address gets one too). */
export async function changeEmail(email: string) {
  return timed(supabase().auth.updateUser({ email }, { emailRedirectTo: redirectTo() }));
}
/** Signing out also clears this device's progress (and how the site speaks to them), so the next person on a
 * shared device starts fresh. */
export async function signOut() {
  await supabase().auth.signOut();
  writeLocal(emptyProgress());
  applyGender(null);
  clearLocalGames();
}
export async function deleteAccount() {
  const { error } = await supabase().rpc('delete_my_account');
  if (error) return { error };
  await signOut();
  return { error: null };
}

// ---------- masculine / feminine (lib/gender.ts) ----------
// Kept in the account's user_metadata, not in profiles: profiles are public, this is no one else's business.
export const accountGender = (session: Session): Gender | null => {
  const v = session.user.user_metadata?.gender;
  return v === 'm' || v === 'f' ? v : null;
};
export async function saveGender(v: Gender): Promise<boolean> {
  const { error } = await supabase().auth.updateUser({ data: { gender: v } });
  return !error;
}
/** On every signed-in page: the account's choice wins; a choice made on this device first goes to the account. */
export async function syncGender(session: Session): Promise<void> {
  const v = accountGender(session);
  if (v) { if (v !== savedGender()) applyGender(v); return; }
  const local = savedGender();
  if (local) await saveGender(local);
}

// ---------- nickname ----------
export interface Profile { id: string; nickname: string; rating: number }
export async function getProfile(userId: string): Promise<Profile | null> {
  const { data } = await supabase().from('profiles').select('id, nickname, rating').eq('id', userId).maybeSingle();
  return data;
}
/** Returns 'taken' when someone already has the nickname (unique, case-insensitive). */
export async function saveNickname(userId: string, nickname: string, isNew: boolean): Promise<'ok' | 'taken' | 'reserved' | 'error'> {
  const q = isNew
    ? supabase().from('profiles').insert({ id: userId, nickname })
    : supabase().from('profiles').update({ nickname }).eq('id', userId);
  const { error } = await q;
  if (!error) return 'ok';
  if (error.code === '23505') return 'taken';
  return error.code === '23514' ? 'reserved' : 'error';
}

// ---------- email nudges (opt-in; supabase/migrations/0005_notifications.sql, sent by api/notify.ts) ----------
export interface EmailPrefs { email_week: boolean; email_return: boolean; paused_reason: string | null }
export async function getEmailPrefs(): Promise<EmailPrefs | null> {
  const session = await getSession();
  if (!session) return null;
  const { data, error } = await supabase().from('notification_prefs').select('email_week, email_return, paused_reason').eq('user_id', session.user.id).maybeSingle();
  if (error) return null;
  return data ?? { email_week: false, email_return: false, paused_reason: null };
}
/** The server records when and where consent was given, and which wording was shown. */
export async function setEmailPrefs(week: boolean, ret: boolean, source: 'signup' | 'settings'): Promise<boolean> {
  const { error } = await supabase().rpc('set_email_prefs', { week, ret, source, version: CONSENT_VERSION });
  return !error;
}
/** The box ticked on the sign-up form, saved once the account exists, then cleared from the account. */
export async function applySignupConsent(session: Session): Promise<void> {
  if (!session.user.user_metadata?.email_week_opt_in) return;
  if (await setEmailPrefs(true, false, 'signup')) await supabase().auth.updateUser({ data: { email_week_opt_in: null } });
}
/** A signed-in visit, at most once a day: "come back" emails count days away from the last one. */
export async function touchLastSeen() {
  const KEY = 'shogi-il.seen-day';
  const today = new Date().toISOString().slice(0, 10);
  try { if (localStorage.getItem(KEY) === today) return; } catch { /* no storage: touch anyway */ }
  const { error } = await supabase().rpc('touch_last_seen');
  if (!error) try { localStorage.setItem(KEY, today); } catch { /* fine */ }
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

const HISTORY_KEY = 'shogi-il.play.history'; // finished games on this device (src/play/record.ts)
const SENT_KEY = 'shogi-il.play.sent'; // ids of those already in the account

function readJson<T>(key: string, fallback: T): T {
  try {
    const v = JSON.parse(localStorage.getItem(key) || 'null');
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

function clearLocalGames() {
  try {
    localStorage.removeItem(HISTORY_KEY);
    localStorage.removeItem(SENT_KEY);
  } catch { /* fine */ }
}

/** Log this device's finished games that the account doesn't have yet. The (user, client_id) key drops repeats. */
export async function syncGames(): Promise<number> {
  const session = await getSession();
  if (!session) return 0;
  const sent = new Set(readJson<string[]>(SENT_KEY, []));
  const todo = readJson<GameRecord[]>(HISTORY_KEY, []).filter((r) => r?.id && r.result && !sent.has(r.id));
  if (!todo.length) return 0;
  const { recordKif } = await import('../play/record-kif');
  const rows = todo.map((r) => {
    let kif: string | null = null;
    try { kif = recordKif(r); } catch { /* bad record: log the result without the file */ }
    return {
      user_id: session.user.id,
      client_id: r.id,
      opponent: 'ai',
      level: r.level,
      color: r.playerColor,
      result: gameResult(r),
      moves: Math.min(r.moves.length, 1000),
      kif,
      played_at: r.endedAt ?? r.startedAt,
    };
  });
  const { error } = await supabase().from('games').upsert(rows, { onConflict: 'user_id,client_id', ignoreDuplicates: true });
  if (error) return 0;
  for (const r of todo) sent.add(r.id);
  try { localStorage.setItem(SENT_KEY, JSON.stringify([...sent].slice(-500))); } catch { /* sent again next time; harmless */ }
  return rows.length;
}

// ---------- progress ----------
/** Pull the account's progress, merge it with this device's, and save the union on both sides.
 * Null when the account couldn't be read or written (the device keeps its copy either way). */
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
    const { error: saveError } = await db.from('progress').upsert({ user_id: session.user.id, data: merged, updated_at: new Date().toISOString() });
    if (saveError) return null;
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
  document.addEventListener('shogi-il:game-end', () => { void syncGames(); later(); }); // the course counts games played
  void syncProgress();
  void syncGames();
  void touchLastSeen();
  void getSession().then((s) => s && syncGender(s));
}
