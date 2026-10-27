// Reports for the site owner (api/admin-report.ts): an email on each new sign-up, and a daily and a weekly summary
// of who signed up, who played and who moved up, one line per player, with a few insights on top.
// Who moved up is the difference between today's totals and an earlier daily snapshot (table admin_snapshots,
// supabase/migrations/0007_admin_reports.sql). The address the reports go to is an environment variable, never
// in the repository, and players are named by nickname only.
// Pure functions (tested in test/admin-report.test.ts). .js on the imports: the email job runs this file on Node.
import { nextStep, placeLabel } from './curriculum.js';
import { LEVEL_COUNTS } from './level-counts.js';
import { israelDay } from './notify.js';
import { normalize, stats } from './progress-sync.js';
import { rankFor, xpBreakdown } from './xp.js';

export const REPORT_FROM = 'שוגי ישראל <noreply@shogi.co.il>';
const DAY = 24 * 60 * 60 * 1000;

/** One player's totals, as kept in admin_snapshots. */
export interface Totals { xp: number; levels_done: number; rules_done: number; tsume_solved: number; games: number; wins: number }

export interface PlayerInput {
  id: string;
  nickname: string | null;  // null: signed up but never picked a nickname
  created_at: string;       // the auth account
  confirmed: boolean;
  progress: unknown;        // progress.data
  progress_at: string | null;
  games: number;            // finished games against the computer (games table)
  wins: number;
  last_game_at: string | null;
  last_seen_at: string | null;
  email_week: boolean;
}

export function totals(p: PlayerInput): Totals {
  const prog = normalize(p.progress);
  const s = stats(prog, LEVEL_COUNTS);
  const tsume = Object.values(prog.tsume).reduce((t, list) => t + list.length, 0);
  return { xp: xpBreakdown(prog, LEVEL_COUNTS).total, levels_done: s.levelsDone, rules_done: s.rulesDone, tsume_solved: tsume, games: p.games, wins: p.wins };
}

export interface PlayerLine {
  id: string;
  nickname: string;
  isNew: boolean;
  active: boolean;
  now: Totals;
  delta: Totals;          // zero when there is no earlier snapshot
  rank: string;
  rankUp: string | null;  // the earlier rank, when the player moved up
  next: string | null;    // the next step on the course path
  /** Starting point in the course, in Hebrew ("בינוניים · מסלול לשחקני שחמט"), or null if not chosen. */
  place: string | null;
  lastSeen: string | null;
  emailWeek: boolean;
}

export interface Report {
  kind: 'daily' | 'weekly';
  since: Date;
  now: Date;
  total: number;
  newCount: number;
  unconfirmed: number;
  noNickname: number;
  active: PlayerLine[];
  idle: PlayerLine[];     // everyone else, newest first
  insights: string[];
  baseline: boolean;      // no earlier snapshot yet: changes can't be shown
}

const zero = (): Totals => ({ xp: 0, levels_done: 0, rules_done: 0, tsume_solved: 0, games: 0, wins: 0 });
const minus = (a: Totals, b: Totals): Totals => ({
  xp: a.xp - b.xp, levels_done: a.levels_done - b.levels_done, rules_done: a.rules_done - b.rules_done,
  tsume_solved: a.tsume_solved - b.tsume_solved, games: a.games - b.games, wins: a.wins - b.wins,
});
const after = (iso: string | null, t: Date) => !!iso && Date.parse(iso) > t.getTime();

/**
 * players: everyone with an account. before: each player's snapshot from the start of the period
 * (missing for players who joined since, or when no snapshot is that old yet).
 */
export function buildReport(kind: 'daily' | 'weekly', players: PlayerInput[], before: Map<string, Totals> | null, now: Date): Report {
  const since = new Date(now.getTime() - (kind === 'daily' ? 1 : 7) * DAY);
  const lines: PlayerLine[] = players.map((p) => {
    const t = totals(p);
    const isNew = after(p.created_at, since);
    const prev = before?.get(p.id) ?? (isNew ? zero() : null);
    const delta = prev ? minus(t, prev) : zero();
    const moved = Object.values(delta).some((x) => x > 0);
    const active = moved || after(p.last_seen_at, since) || after(p.last_game_at, since) || after(p.progress_at, since);
    const rank = rankFor(t.xp).rank.name;
    const was = prev ? rankFor(prev.xp).rank.name : rank;
    const prog = normalize(p.progress);
    return {
      id: p.id, nickname: p.nickname ?? '(בלי כינוי)', isNew, active, now: t, delta, rank,
      rankUp: was !== rank ? was : null,
      next: nextStep(prog, LEVEL_COUNTS)?.step.title ?? null,
      place: placeLabel(prog.course) || null,
      lastSeen: p.last_seen_at, emailWeek: p.email_week,
    };
  });
  const byXp = (a: PlayerLine, b: PlayerLine) => b.delta.xp - a.delta.xp || b.now.xp - a.now.xp;
  const active = lines.filter((l) => l.active || l.isNew).sort(byXp);
  const created = new Map(players.map((p) => [p.id, p.created_at]));
  const idle = lines.filter((l) => !l.active && !l.isNew).sort((a, b) => Date.parse(created.get(b.id)!) - Date.parse(created.get(a.id)!));
  const report: Report = {
    kind, since, now, total: players.length,
    newCount: lines.filter((l) => l.isNew).length,
    unconfirmed: players.filter((p) => !p.confirmed).length,
    noNickname: players.filter((p) => p.confirmed && !p.nickname).length,
    active, idle, insights: [], baseline: !before,
  };
  report.insights = insights(report, players, now);
  return report;
}

function insights(r: Report, players: PlayerInput[], now: Date): string[] {
  const out: string[] = [];
  const all = [...r.active, ...r.idle];
  const period = r.kind === 'daily' ? 'ביום האחרון' : 'בשבוע האחרון';
  if (!r.total) return ['עוד אין חשבונות באתר.'];
  const movers = r.active.filter((l) => l.delta.xp > 0);
  if (movers.length) out.push(`${movers.length} מתוך ${r.total} התקדמו ${period}. הכי הרבה: ${movers[0].nickname} (+${movers[0].delta.xp} נקודות).`);
  else if (!r.baseline) out.push(`אף אחד לא צבר נקודות ${period}.`);
  const ups = r.active.filter((l) => l.rankUp);
  if (ups.length) out.push(`עלו דרגה: ${ups.map((l) => `${l.nickname} (${l.rankUp} ← ${l.rank})`).join(', ')}.`);
  // people who signed up a few days ago and did nothing since: worth a personal note
  const stuck = all.filter((l) => l.now.xp === 0 && l.now.games === 0 && players.find((p) => p.id === l.id)!.created_at < new Date(now.getTime() - 3 * DAY).toISOString());
  if (stuck.length) out.push(`נרשמו לפני יותר מ־3 ימים ועוד לא עשו כלום: ${stuck.map((l) => l.nickname).join(', ')}. אולי שווה הודעה אישית.`);
  // the step most players are standing at
  const nexts = new Map<string, number>();
  for (const l of all) if (l.next && (l.now.xp > 0 || l.place)) nexts.set(l.next, (nexts.get(l.next) ?? 0) + 1);
  const top = [...nexts].sort((a, b) => b[1] - a[1])[0];
  if (top && top[1] > 1) out.push(`הצעד הבא הנפוץ במסלול: "${top[0]}" (${top[1]} שחקנים עומדים בו).`);
  const tracks = new Map<string, number>();
  for (const l of all) if (l.place) tracks.set(l.place, (tracks.get(l.place) ?? 0) + 1);
  if (tracks.size) out.push(`נקודת התחלה במסלול: ${[...tracks].sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t} ${n}`).join(', ')}.`);
  const optIn = all.filter((l) => l.emailWeek).length;
  out.push(`${optIn} מתוך ${r.total} ביקשו את המייל השבועי.`);
  if (r.unconfirmed) out.push(`${r.unconfirmed} נרשמו ועוד לא אישרו את המייל.`);
  if (r.noNickname) out.push(`${r.noNickname} אישרו את המייל ועוד לא בחרו כינוי.`);
  if (players.every((p) => p.progress == null)) out.push('אין עדיין התקדמות שמורה באף חשבון: שמירת ההתקדמות בחשבון עולה עם התיקון בחשבון (migration 0006).');
  if (r.baseline) out.push('זה הדוח הראשון, אז השינויים יופיעו מהדוח הבא.');
  return out;
}

// ---------- the emails ----------
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const fmtDay = (d: Date | string) => new Intl.DateTimeFormat('he-IL', { timeZone: 'Asia/Jerusalem', day: 'numeric', month: 'numeric' }).format(new Date(d));
const fmtWhen = (d: Date | string) => new Intl.DateTimeFormat('he-IL', { timeZone: 'Asia/Jerusalem', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(d));
const plus = (n: number) => (n > 0 ? ` <b style="color:#15803d">+${n}</b>` : '');
const plusText = (n: number) => (n > 0 ? ` (+${n})` : '');

export interface Email { subject: string; html: string; text: string }

function wrap(title: string, body: string): string {
  return `<!doctype html><html lang="he" dir="rtl"><body style="margin:0;padding:16px;background:#f6f5f2;font-family:Arial,sans-serif;color:#1c1917">
<div style="max-width:720px;margin:0 auto;background:#fff;border-radius:10px;padding:20px">
<h1 style="font-size:20px;margin:0 0 12px">${esc(title)}</h1>${body}
<p style="color:#78716c;font-size:12px;margin-top:20px">דוח פנימי של shogi.co.il, נשלח רק אליך.</p></div></body></html>`;
}

const TD = 'style="padding:6px 8px;border-bottom:1px solid #e7e5e4;text-align:right;vertical-align:top"';
function table(lines: PlayerLine[]): string {
  const head = ['שחקן', 'דרגה', 'נקודות', 'שלבים', 'שיעורים', 'בעיות', 'משחקים', 'הצעד הבא'];
  const rows = lines.map((l) => `<tr>
<td ${TD}><b>${esc(l.nickname)}</b>${l.isNew ? ' <span style="color:#b91c1c">חדש</span>' : ''}${l.emailWeek ? ' ✉' : ''}</td>
<td ${TD}>${esc(l.rank)}${l.rankUp ? ' ⬆' : ''}</td>
<td ${TD}>${l.now.xp}${plus(l.delta.xp)}</td>
<td ${TD}>${l.now.levels_done}${plus(l.delta.levels_done)}</td>
<td ${TD}>${l.now.rules_done}${plus(l.delta.rules_done)}</td>
<td ${TD}>${l.now.tsume_solved}${plus(l.delta.tsume_solved)}</td>
<td ${TD}>${l.now.games}${plus(l.delta.games)}${l.now.wins ? ` (${l.now.wins} ניצחונות)` : ''}</td>
<td ${TD}>${l.next ? esc(l.next) : '<span style="color:#78716c">סיים את המסלול</span>'}</td></tr>`).join('');
  return `<table style="border-collapse:collapse;width:100%;font-size:13px"><tr>${head.map((h) => `<th ${TD}>${h}</th>`).join('')}</tr>${rows}</table>`;
}

export function reportEmail(r: Report): Email {
  const label = r.kind === 'daily' ? 'הדוח היומי' : 'הדוח השבועי';
  const range = r.kind === 'daily' ? fmtDay(r.now) : `${fmtDay(r.since)}–${fmtDay(r.now)}`;
  const subject = `${label} של שוגי ישראל, ${range}: ${r.newCount} נרשמו, ${r.active.filter((l) => l.active).length} פעילים`;
  const nums = [
    ['חשבונות', r.total], ['נרשמו', r.newCount], ['פעילים', r.active.filter((l) => l.active).length], ['עלו דרגה', r.active.filter((l) => l.rankUp).length],
  ];
  const tiles = `<table style="width:100%;margin-bottom:12px"><tr>${nums.map(([k, v]) => `<td style="background:#fafaf9;border-radius:8px;padding:10px;text-align:center"><div style="font-size:22px;font-weight:bold">${v}</div><div style="font-size:12px;color:#57534e">${k}</div></td>`).join('<td style="width:8px"></td>')}</tr></table>`;
  const ins = `<h2 style="font-size:16px;margin:16px 0 6px">תובנות</h2><ul style="margin:0;padding-inline-start:20px">${r.insights.map((i) => `<li style="margin-bottom:4px">${esc(i)}</li>`).join('')}</ul>`;
  const act = r.active.length ? `<h2 style="font-size:16px;margin:16px 0 6px">מי שיחק ומי נרשם</h2>${table(r.active)}` : '';
  const idle = r.idle.length ? `<h2 style="font-size:16px;margin:16px 0 6px">השאר (לא היו פעילים)</h2>${table(r.idle)}` : '';
  const legend = '<p style="font-size:12px;color:#78716c">✉ ביקש את המייל השבועי. ⬆ עלה דרגה. ירוק: השינוי בתקופה. הדרגות הן דרגות הלמידה של המסלול.</p>';
  const html = wrap(`${label}, ${range}`, tiles + ins + act + idle + legend);
  const line = (l: PlayerLine) =>
    `- ${l.nickname}${l.isNew ? ' (חדש)' : ''}: ${l.rank}${l.rankUp ? ` (עלה מ${l.rankUp})` : ''}, ${l.now.xp} נקודות${plusText(l.delta.xp)}, שלבים ${l.now.levels_done}${plusText(l.delta.levels_done)}, שיעורים ${l.now.rules_done}${plusText(l.delta.rules_done)}, בעיות ${l.now.tsume_solved}${plusText(l.delta.tsume_solved)}, משחקים ${l.now.games}${plusText(l.delta.games)}. הבא: ${l.next ?? 'סיים'}`;
  const text = [
    `${label}, ${range}`, '',
    nums.map(([k, v]) => `${k}: ${v}`).join(' | '), '',
    'תובנות:', ...r.insights.map((i) => `- ${i}`), '',
    ...(r.active.length ? ['מי שיחק ומי נרשם:', ...r.active.map(line), ''] : []),
    ...(r.idle.length ? ['השאר:', ...r.idle.map(line)] : []),
  ].join('\n');
  return { subject, html, text };
}

export interface SignupInput { nickname: string; created_at: string; total: number; email_week: boolean }
export function signupEmail(list: SignupInput[]): Email {
  const names = list.map((s) => s.nickname).join(', ');
  const total = Math.max(...list.map((s) => s.total));
  const subject = list.length === 1 ? `נרשם חדש בשוגי ישראל: ${names}` : `${list.length} נרשמים חדשים בשוגי ישראל: ${names}`;
  const items = list.map((s) => `<li><b>${esc(s.nickname)}</b>, ${fmtWhen(s.created_at)}${s.email_week ? ', ביקש את המייל השבועי' : ''}</li>`).join('');
  const html = wrap(subject, `<ul style="padding-inline-start:20px">${items}</ul><p>עכשיו יש ${total} חשבונות באתר. מה הם עושים יופיע בדוח היומי.</p>`);
  const text = [subject, '', ...list.map((s) => `- ${s.nickname}, ${fmtWhen(s.created_at)}${s.email_week ? ', ביקש את המייל השבועי' : ''}`), '', `עכשיו יש ${total} חשבונות באתר.`].join('\n');
  return { subject, html, text };
}

/** The daily report goes every day; the weekly one too on Sundays (Israel time). */
export function reportsDue(now: Date): ('daily' | 'weekly')[] {
  return israelDay(now).weekday === 0 ? ['daily', 'weekly'] : ['daily'];
}
