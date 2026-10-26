// Which ad brought a visitor, so a new account can say so. When someone lands from one of our ads, the link
// carries utm_source / utm_medium / utm_campaign (the links table is in the ads plan). We keep that in
// sessionStorage for this tab only, and signUp() saves it on the new account (user_metadata.ad_source).
// No cookies, nothing sent anywhere else, nothing kept once the tab closes. Read it in the Supabase SQL editor:
//   select created_at, raw_user_meta_data->'ad_source' from auth.users where raw_user_meta_data ? 'ad_source';

export type AdSource = { source: string; medium?: string; campaign?: string; content?: string; landing: string };

const KEY = 'shogi-il.ad-source';
// Our own campaign names are short and plain; anything else is dropped rather than stored.
const clean = (v: string | null) => (v && /^[A-Za-z0-9_.-]{1,40}$/.test(v) ? v : undefined);

/** The ad parameters in a landing URL's query string, or null when there is no (valid) utm_source. */
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

/** On every page load: remember the first ad landing of this tab. Later pages without utm_ keep it. */
export function rememberAdSource(): void {
  const found = parseAdSource(location.search, location.pathname);
  if (!found) return;
  try {
    if (!sessionStorage.getItem(KEY)) sessionStorage.setItem(KEY, JSON.stringify(found));
  } catch { /* no storage: the account just won't know the ad */ }
}

/** The ad this tab came from, if any. */
export function adSource(): AdSource | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(KEY) || 'null');
    return v && typeof v.source === 'string' ? (v as AdSource) : null;
  } catch {
    return null;
  }
}
