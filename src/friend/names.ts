// AGPL-3.0-or-later, like the rest of this site.
export const NAME_MIN = 2;
export const NAME_MAX = 16;

export type NameProblem = 'empty' | 'short' | 'long' | 'chars' | 'letter' | 'phone' | 'blocked';

const ALLOWED = /^[A-Za-z0-9א-ת _'׳-]+$/;
const LETTER = /[A-Za-zא-ת]/;
const RESERVED = /(admin|moderator|support|shogi.?israel|shogiisrael|official|staff|system|root|מנהל|הנהלה|שוגי.?ישראל|רשמי|צוות|תמיכה)/;

export const tidyName = (v: unknown): string => (typeof v === 'string' ? v.normalize('NFC').replace(/\s+/g, ' ').trim() : '');

export function nameProblem(name: string): NameProblem | null {
  if (!name) return 'empty';
  const n = [...name].length;
  if (n < NAME_MIN) return 'short';
  if (n > NAME_MAX) return 'long';
  if (!ALLOWED.test(name)) return 'chars';
  if (!LETTER.test(name)) return 'letter';
  if (name.replace(/\D/g, '').length >= 7) return 'phone';
  if (RESERVED.test(name.toLowerCase().replace(/[\s_'׳-]/g, ''))) return 'blocked';
  return null;
}

const FROM = '013457ךםןףץ';
const TO = 'oieastכמנפצ';

export function plainName(name: string): string {
  const low = name.toLowerCase().replace(/[\s_'׳-]/g, '');
  return [...low].map((c) => { const i = FROM.indexOf(c); return i < 0 ? c : TO[i]; }).join('').replace(/(.)\1+/gu, '$1');
}

export interface BlockedWord { word: string; whole: boolean }

export function blockedName(name: string, words: BlockedWord[]): boolean {
  const plain = plainName(name);
  const parts = name.split(' ').map(plainName);
  return words.some((w) => {
    const word = plainName(w.word);
    return word.length > 1 && (w.whole ? plain === word || parts.includes(word) : plain.includes(word));
  });
}

export const LABEL_MAX = 30;

export const tidyLabel = (v: unknown): string => [...tidyName(v).replace(/\p{C}/gu, '')].slice(0, LABEL_MAX).join('').trim();

export const pre = (letter: string, name: string): string => (/^[A-Za-z0-9]/.test(name) ? `${letter}-` : letter);
