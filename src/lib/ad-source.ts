export type AdSource = { source: string; medium?: string; campaign?: string; content?: string; landing: string };

const KEY = 'shogi-il.ad-source';
const clean = (v: string | null) => (v && /^[A-Za-z0-9_.-]{1,40}$/.test(v) ? v : undefined);

export function parseAdSource(search: string, path: string): AdSource | null {
  const q = new URLSearchParams(search);
  const source = clean(q.get('utm_source'));
  if (!source) return null;
  const out: AdSource = { source, landing: path.slice(0, 80) };
  const medium = clean(q.get('utm_medium'));
  const campaign = clean(q.get('utm_campaign'));
  const content = clean(q.get('utm_content'));
  if (medium) out.medium = medium;
  if (campaign) out.campaign = campaign;
  if (content) out.content = content;
  return out;
}

export function rememberAdSource(): void {
  const found = parseAdSource(location.search, location.pathname);
  if (!found) return;
  try {
    if (!sessionStorage.getItem(KEY)) sessionStorage.setItem(KEY, JSON.stringify(found));
  } catch { }
}

export function adSource(): AdSource | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(KEY) || 'null');
    return v && typeof v.source === 'string' ? (v as AdSource) : null;
  } catch {
    return null;
  }
}
