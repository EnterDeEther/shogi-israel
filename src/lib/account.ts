import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import { AUTH_STORAGE_KEY, SUPABASE_KEY, SUPABASE_URL } from './account-config';
import type { GameRecord } from '../play/record';
import { emptyProgress, gameResult, merge, mergeSignIn, normalize, same, type SyncedProgress } from './progress-sync';
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

const redirectTo = () => `${window.location.origin}/account/`;

export async function signUp(email: string, password: string, captchaToken?: string, weeklyEmail = false, gender?: Gender) {
  const ad = adSource();
  const data = { ...(weeklyEmail ? { email_week_opt_in: CONSENT_VERSION } : {}), ...(gender ? { gender } : {}), ...(ad ? { ad_source: ad } : {}) };
  return supabase().auth.signUp({ email, password, options: { emailRedirectTo: redirectTo(), captchaToken, data } });
}
export async function signIn(email: string, password: string, captchaToken?: string) {
  return supabase().auth.signInWithPassword({ email, password, options: { captchaToken } });
}
export async function verifySignupCode(email: string, token: string) {
  return supabase().auth.verifyOtp({ email, token, type: 'email' });
}
export async function sendPasswordReset(email: string, captchaToken?: string) {
  return supabase().auth.resetPasswordForEmail(email, { redirectTo: redirectTo(), captchaToken });
}
export async function verifyResetLink(tokenHash: string) {
  return supabase().auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' });
}
export function timed<T>(p: Promise<T>, ms = 20000): Promise<T> {
  return Promise.race([p, new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);
}
export async function setPassword(password: string, nonce?: string) {
  return timed(supabase().auth.updateUser(nonce ? { password, nonce } : { password }));
}
export async function reauthenticate() {
  return timed(supabase().auth.reauthenticate());
}
export async function changeEmail(email: string) {
  return timed(supabase().auth.updateUser({ email }, { emailRedirectTo: redirectTo() }));
}
export async function signOut() {
  await supabase().auth.signOut();
  writeLocal(emptyProgress());
  setLinked(null);
  applyGender(null);
  clearLocalGames();
}
export async function deleteAccount() {
  const { error } = await supabase().rpc('delete_my_account');
  if (error) return { error };
  await signOut();
  return { error: null };
}

export const accountGender = (session: Session): Gender | null => {
  const v = session.user.user_metadata?.gender;
  return v === 'm' || v === 'f' ? v : null;
};
export async function saveGender(v: Gender): Promise<boolean> {
  const { error } = await supabase().auth.updateUser({ data: { gender: v } });
  return !error;
}
export async function syncGender(session: Session): Promise<void> {
  const v = accountGender(session);
  if (v) { if (v !== savedGender()) applyGender(v); return; }
  const local = savedGender();
  if (local) await saveGender(local);
}

export interface Profile { id: string; nickname: string; rating: number }
export async function getProfile(userId: string): Promise<Profile | null> {
  const { data } = await supabase().from('profiles').select('id, nickname, rating').eq('id', userId).maybeSingle();
  return data;
}
export async function saveNickname(userId: string, nickname: string, isNew: boolean): Promise<'ok' | 'taken' | 'reserved' | 'error'> {
  const q = isNew
    ? supabase().from('profiles').insert({ id: userId, nickname })
    : supabase().from('profiles').update({ nickname }).eq('id', userId);
  const { error } = await q;
  if (!error) return 'ok';
  if (error.code === '23505') return 'taken';
  return error.code === '23514' ? 'reserved' : 'error';
}

export interface EmailPrefs { email_week: boolean; email_return: boolean; paused_reason: string | null }
export async function getEmailPrefs(): Promise<EmailPrefs | null> {
  const session = await getSession();
  if (!session) return null;
  const { data, error } = await supabase().from('notification_prefs').select('email_week, email_return, paused_reason').eq('user_id', session.user.id).maybeSingle();
  if (error) return null;
  return data ?? { email_week: false, email_return: false, paused_reason: null };
}
export async function setEmailPrefs(week: boolean, ret: boolean, source: 'signup' | 'settings'): Promise<boolean> {
  const { error } = await supabase().rpc('set_email_prefs', { week, ret, source, version: CONSENT_VERSION });
  return !error;
}
export async function applySignupConsent(session: Session): Promise<void> {
  if (!session.user.user_metadata?.email_week_opt_in) return;
  if (await setEmailPrefs(true, false, 'signup')) await supabase().auth.updateUser({ data: { email_week_opt_in: null } });
}
export async function touchLastSeen() {
  const KEY = 'shogi-il.seen-day';
  const today = new Date().toISOString().slice(0, 10);
  try { if (localStorage.getItem(KEY) === today) return; } catch { }
  const { error } = await supabase().rpc('touch_last_seen');
  if (!error) try { localStorage.setItem(KEY, today); } catch { }
}

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

const HISTORY_KEY = 'shogi-il.play.history';
const SENT_KEY = 'shogi-il.play.sent';

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
  } catch { }
}

export async function syncGames(): Promise<number> {
  const session = await getSession();
  if (!session) return 0;
  const sent = new Set(readJson<string[]>(SENT_KEY, []));
  const todo = readJson<GameRecord[]>(HISTORY_KEY, []).filter((r) => r?.id && r.result && !sent.has(r.id));
  if (!todo.length) return 0;
  const { recordKif } = await import('../play/record-kif');
  const rows = todo.map((r) => {
    let kif: string | null = null;
    try { kif = recordKif(r); } catch { }
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
  try { localStorage.setItem(SENT_KEY, JSON.stringify([...sent].slice(-500))); } catch { }
  return rows.length;
}

const LINKED_KEY = 'shogi-il.progress.linked';
const linkedTo = (id: string) => { try { return localStorage.getItem(LINKED_KEY) === id; } catch { return false; } };
const setLinked = (id: string | null) => {
  try { if (id) localStorage.setItem(LINKED_KEY, id); else localStorage.removeItem(LINKED_KEY); } catch { }
};

export async function syncProgress(opts: { keepDeviceCourse?: boolean } = {}): Promise<SyncedProgress | null> {
  const session = await getSession();
  if (!session) return null;
  const db = supabase();
  const { data, error } = await db.from('progress').select('data').eq('user_id', session.user.id).maybeSingle();
  if (error) return null;
  const local = readLocal();
  const remote = normalize(data?.data);
  const merged = linkedTo(session.user.id) ? merge(local, remote) : mergeSignIn(local, remote);
  if (opts.keepDeviceCourse && local.course.route) {
    merged.course.route = local.course.route;
    merged.course.start = local.course.start;
    merged.course.placedAt = local.course.placedAt;
  }
  if (!same(merged, local)) {
    writeLocal(merged);
    document.dispatchEvent(new CustomEvent('progress-synced'));
  }
  if (!data || !same(merged, remote)) {
    const { error: saveError } = await db.from('progress').upsert({ user_id: session.user.id, data: merged, updated_at: new Date().toISOString() });
    if (saveError) return null;
  }
  setLinked(session.user.id);
  return merged;
}

async function pushLocal() {
  const session = await getSession();
  if (!session) return;
  if (!linkedTo(session.user.id)) { await syncProgress({ keepDeviceCourse: true }); return; }
  await supabase().from('progress').upsert({ user_id: session.user.id, data: readLocal(), updated_at: new Date().toISOString() });
}

export function startSync() {
  let timer: number | undefined;
  const later = () => { clearTimeout(timer); timer = window.setTimeout(() => void syncProgress(), 1500); };
  document.addEventListener('progress-changed', later);
  document.addEventListener('progress-reset', () => void pushLocal());
  window.addEventListener('pagehide', () => { if (timer) void syncProgress(); });
  document.addEventListener('shogi-il:game-end', () => { void syncGames(); later(); });
  void syncProgress();
  void syncGames();
  void touchLastSeen();
  void getSession().then((s) => s && syncGender(s));
}
