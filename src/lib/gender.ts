export type Gender = 'm' | 'f';

export const GENDER_KEY = 'gender';
export const TOKEN = /⟦([^⟦⟧|]*)\|([^⟦⟧]*)⟧/g;

export const hasToken = (s: string): boolean => s.includes('⟦');

export const resolve = (s: string, g: Gender = 'm'): string =>
  hasToken(s) ? s.replace(TOKEN, (_, m: string, f: string) => (g === 'f' ? f : m)) : s;

export const asGender = (v: unknown): Gender => (v === 'f' ? 'f' : 'm');

export const spans = (m: string, f: string): string => `<span class="gm">${m}</span><span class="gf">${f}</span>`;

export const GENDER_ATTRS = ['aria-label', 'title', 'placeholder', 'alt', 'aria-description', 'data-tip'];

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

function rawText(el: string, tag: string): string {
  if (tag !== 'title' || !hasToken(el)) return resolve(el);
  const m = /^(<title\b[^>]*)>([\s\S]*)<\/title>$/i.exec(el);
  return m ? `${resolve(m[1])} data-g="${escAttr(m[2])}">${resolve(m[2])}</title>` : resolve(el);
}

const escAttr = (s: string): string => s.replace(/"/g, '&quot;');

const markup = (s: string): string =>
  s.replace(/<[^>]*>|[^<]+/g, (part) => (part.startsWith('<') ? tag(part) : part.replace(TOKEN, (_, m: string, f: string) => spans(m, f))));

function tag(t: string): string {
  if (!hasToken(t)) return t;
  const keep = [...t.matchAll(/\s([\w-]+)="([^"]*)"/g)]
    .filter(([, name, v]) => GENDER_ATTRS.includes(name) && hasToken(v))
    .map(([, name, v]) => ` data-g-${name}="${v}"`);
  return resolve(t).replace(/(\/?>)$/, `${keep.join('')}$1`);
}

export const currentGender = (): Gender =>
  typeof document !== 'undefined' && document.documentElement.getAttribute('data-gender') === 'f' ? 'f' : 'm';

export const g = (s: string): string => resolve(s, currentGender());

export function savedGender(): Gender | null {
  try { const v = localStorage.getItem(GENDER_KEY); return v === 'm' || v === 'f' ? v : null; } catch { return null; }
}

export function applyGender(v: Gender | null): void {
  const root = document.documentElement;
  try { if (v) localStorage.setItem(GENDER_KEY, v); else localStorage.removeItem(GENDER_KEY); } catch { }
  if (v === 'f') root.setAttribute('data-gender', 'f'); else root.removeAttribute('data-gender');
  document.dispatchEvent(new CustomEvent('gender-changed', { detail: v ?? 'm' }));
}
