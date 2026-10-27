// The site speaks to one reader: in masculine by default, in feminine to a reader who chose it
// (at sign-up or in the account settings; saved in the account's user_metadata.gender).
// Gendered words are written once, as a token with both forms: ⟦לחץ|לחצי⟧.
// - Static HTML: src/middleware.ts turns each token into two spans, and CSS shows one by html[data-gender].
// - Text that scripts insert later: src/scripts/gender.ts does the same as the nodes land.
// - Plain text (emails, attributes): resolve(text, gender).
export type Gender = 'm' | 'f';

export const GENDER_KEY = 'gender';
export const TOKEN = /⟦([^⟦⟧|]*)\|([^⟦⟧]*)⟧/g;

export const hasToken = (s: string): boolean => s.includes('⟦');

export const resolve = (s: string, g: Gender = 'm'): string =>
  hasToken(s) ? s.replace(TOKEN, (_, m: string, f: string) => (g === 'f' ? f : m)) : s;

export const asGender = (v: unknown): Gender => (v === 'f' ? 'f' : 'm');

/** HTML that holds both forms; the stylesheet shows the reader's. Input is HTML-safe text. */
export const spans = (m: string, f: string): string => `<span class="gm">${m}</span><span class="gf">${f}</span>`;

/** Attributes that are read out or shown (aria-label, tooltips, placeholders). They can't hold spans, so they
 *  carry the masculine form and keep both forms in data-g-<name>, for the page script to switch. */
export const GENDER_ATTRS = ['aria-label', 'title', 'placeholder', 'alt', 'aria-description', 'data-tip'];

/** Turns tokens in a full HTML document into spans, and into the masculine form where spans can't go:
 *  attribute values, <title>, <option>, <script>, <style>, <textarea>. */
export function genderHtml(html: string): string {
  if (!hasToken(html)) return html;
  const raw = /<(script|style|title|textarea|option)\b[^>]*>[\s\S]*?<\/\1>/gi;
  let out = '';
  let last = 0;
  for (const m of html.matchAll(raw)) {
    out += markup(html.slice(last, m.index)) + rawText(m[0], m[1].toLowerCase());
    last = m.index + m[0].length;
  }
  return out + markup(html.slice(last));
}

// <title> keeps both forms in data-g, so the page script can retitle the tab for a woman reader.
function rawText(el: string, tag: string): string {
  if (tag !== 'title' || !hasToken(el)) return resolve(el);
  const m = /^(<title\b[^>]*)>([\s\S]*)<\/title>$/i.exec(el);
  return m ? `${resolve(m[1])} data-g="${escAttr(m[2])}">${resolve(m[2])}</title>` : resolve(el);
}

// The title's text is already HTML-escaped; only its quotes need escaping inside an attribute.
const escAttr = (s: string): string => s.replace(/"/g, '&quot;');

// Outside raw-text elements: text tokens become spans, tag tokens the masculine form (see GENDER_ATTRS).
const markup = (s: string): string =>
  s.replace(/<[^>]*>|[^<]+/g, (part) => (part.startsWith('<') ? tag(part) : part.replace(TOKEN, (_, m: string, f: string) => spans(m, f))));

function tag(t: string): string {
  if (!hasToken(t)) return t;
  const keep = [...t.matchAll(/\s([\w-]+)="([^"]*)"/g)]
    .filter(([, name, v]) => GENDER_ATTRS.includes(name) && hasToken(v))
    .map(([, name, v]) => ` data-g-${name}="${v}"`);
  return resolve(t).replace(/(\/?>)$/, `${keep.join('')}$1`);
}

/** The reader's form, in the browser. */
export const currentGender = (): Gender =>
  typeof document !== 'undefined' && document.documentElement.getAttribute('data-gender') === 'f' ? 'f' : 'm';

/** Picks the reader's form of a string with tokens, for places that need plain text (alerts, titles, canvas). */
export const g = (s: string): string => resolve(s, currentGender());

/** The choice saved on this device, or null when the reader never chose. */
export function savedGender(): Gender | null {
  try { const v = localStorage.getItem(GENDER_KEY); return v === 'm' || v === 'f' ? v : null; } catch { return null; }
}

/** Saves the reader's choice on this device and switches the page. */
export function applyGender(v: Gender | null): void {
  const root = document.documentElement;
  try { if (v) localStorage.setItem(GENDER_KEY, v); else localStorage.removeItem(GENDER_KEY); } catch { /* no storage */ }
  if (v === 'f') root.setAttribute('data-gender', 'f'); else root.removeAttribute('data-gender');
  document.dispatchEvent(new CustomEvent('gender-changed', { detail: v ?? 'm' }));
}
