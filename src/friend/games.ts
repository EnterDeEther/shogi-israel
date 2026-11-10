// AGPL-3.0-or-later, like the rest of this site.
import { el } from '../learn/view';
import { accountsEnabled } from '../lib/account-config';
import { downloadKif, kifFileName } from '../lib/kif';
import { api, gameUrl, SHORT_SPEED } from './client';

interface Row {
  key: string;
  at: number;
  title: string;
  detail: string;
  result: string;
  tone: 'won' | 'lost' | 'even' | 'open';
  kif: string | null;
  href?: string;
}

const RESULT = { win: ['ניצחון', 'won'], loss: ['הפסד', 'lost'], draw: ['תיקו', 'even'], abort: ['בוטל', 'even'] } as const;
const dateText = (t: number) => new Date(t).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric', year: '2-digit' });

async function aiGames(): Promise<Row[]> {
  const { supabase } = await import('../lib/account');
  const { data } = await supabase().from('games').select('id, level, color, result, moves, kif, played_at')
    .order('played_at', { ascending: false }).limit(100);
  return (data ?? []).map((g: { id: number; level: number | null; color: Color | null; result: keyof typeof RESULT; moves: number | null; kif: string | null; played_at: string }) => ({
    key: `ai${g.id}`,
    at: Date.parse(g.played_at),
    title: g.level ? `נגד המחשב, רמה ${g.level}` : 'נגד המחשב',
    detail: `${g.color === 'gote' ? 'משיב' : 'פותח'} · ${g.moves ?? 0} מהלכים`,
    result: RESULT[g.result]?.[0] ?? '',
    tone: RESULT[g.result]?.[1] ?? 'even',
    kif: g.kif,
  }));
}

async function friendGames(): Promise<Row[]> {
  const r = await api.mine();
  if (!r.ok) return [];
  return r.data.games.filter((g) => g.status !== 'open' && g.status !== 'cancelled' && g.you).map((g) => {
    const opp = g.names[g.you === 'sente' ? 'gote' : 'sente'];
    const active = g.status === 'active';
    const [result, tone] = active ? [g.yourTurn ? 'תורך' : 'בהמשך', 'open' as const]
      : g.status === 'aborted' ? ['בוטל', 'even' as const]
        : !g.winner ? ['תיקו', 'even' as const] : g.winner === g.you ? ['ניצחון', 'won' as const] : ['הפסד', 'lost' as const];
    return {
      key: `f${g.id}`,
      at: Date.parse(g.updatedAt),
      title: `נגד ${opp}`,
      detail: `${SHORT_SPEED(g.speed, g.days, g.clock)} · ${g.ply} מהלכים`,
      result, tone, kif: g.kif,
      href: active ? gameUrl(g.id) : undefined,
    };
  });
}

export async function bootGames(list: HTMLElement, viewer: HTMLElement): Promise<void> {
  if (!accountsEnabled) { list.replaceChildren(el('p', { class: 'muted' }, 'החשבונות לא פעילים כאן.')); return; }
  const { getSession } = await import('../lib/account');
  if (!(await getSession())) {
    list.replaceChildren(
      el('p', {}, 'כאן יופיעו כל המשחקים ששיחקת עם חשבון: נגד המחשב ונגד חברים.'),
      el('a', { class: 'btn', href: '/account/' }, 'כניסה לחשבון'),
    );
    return;
  }
  list.replaceChildren(el('p', { class: 'muted' }, 'טוענים את המשחקים…'));
  const [ai, friends] = await Promise.all([aiGames().catch(() => []), friendGames().catch(() => [])]);
  const rows = [...ai, ...friends].sort((a, b) => b.at - a.at);
  if (!rows.length) {
    list.replaceChildren(el('p', {}, 'עוד אין משחקים שמורים. ', el('a', { href: '/play/' }, 'משחק נגד המחשב'), ' או ', el('a', { href: '/friend/' }, 'משחק עם חבר'), ' יופיעו כאן.'));
    return;
  }
  const open = (row: Row) => {
    const input = viewer.querySelector<HTMLTextAreaElement>('[data-input]');
    const load = viewer.querySelector<HTMLButtonElement>('[data-load]');
    if (!input || !load || !row.kif) return;
    input.value = row.kif;
    load.click();
    viewer.hidden = false;
    const title = viewer.querySelector<HTMLElement>('[data-replay-title]');
    if (title) title.textContent = `${row.title} · ${dateText(row.at)}`;
    window.scrollTo({ top: viewer.getBoundingClientRect().top + window.scrollY - 80, behavior: 'smooth' });
  };
  list.replaceChildren(el('ul', { class: 'friend-list games-list' }, ...rows.map((row) => el('li', { class: 'friend-row' },
    el('div', { class: 'friend-row__main' },
      el('strong', {}, row.title),
      el('span', { class: 'small muted' }, `${dateText(row.at)} · ${row.detail}`)),
    el('span', { class: `friend-tag ${row.tone}` }, row.result),
    el('div', { class: 'friend-row__side' },
      row.href ? el('a', { class: 'link', href: row.href }, 'להמשך המשחק') : null,
      row.kif ? el('button', { type: 'button', class: 'link', onclick: () => open(row) }, 'צפייה') : null,
      row.kif ? el('button', { type: 'button', class: 'link', onclick: () => downloadKif(row.kif!, kifFileName({ date: new Date(row.at) })) }, 'KIF') : null,
    ),
  ))));
}
