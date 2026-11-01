import { expect, test } from 'bun:test';
import { stages } from '../src/learn/categories';

const ORDER = ['introduction', 'king', 'gold', 'silver', 'knight', 'lance', 'bishop', 'rook', 'pawn',
  'capture', 'drop', 'protection', 'check1', 'outOfCheck', 'checkmate1', 'setup', 'repetition'];

const W = (w: string) => new RegExp(`(?<![א-ת])(${w})(?![א-ת])`);

const TERMS: { name: string; re: RegExp; where: string }[] = [
  { name: 'square', re: /משבצ/, where: 'introduction:1' },
  { name: 'piece', re: /כלי/, where: 'introduction:intro' },
  { name: 'opponent', re: /יריב/, where: 'introduction:1' },
  { name: 'rank', re: /שור(ה|ות)/, where: 'introduction:2' },
  { name: 'promotion zone', re: /אזור ההכתרה/, where: 'introduction:2' },
  { name: 'promotion', re: /הכתר|מוכתר|להכתיר/, where: 'introduction:2' },
  { name: 'move', re: /מהלך|מהלכים/, where: 'introduction:3' },
  { name: 'sente / gote', re: W('פותח|משיב'), where: 'introduction:3' },
  { name: 'star', re: /כוכב/, where: 'king:1' },
  { name: 'general', re: /גנרל/, where: 'gold:intro' },
  { name: 'knight', re: /פרש/, where: 'knight:intro' },
  { name: 'lance', re: /רומח/, where: 'lance:intro' },
  { name: 'hand', re: /ביד|ליד שלך|מהיד/, where: 'bishop:2' },
  { name: 'drop', re: /הצנח|להצניח|מוצנח/, where: 'bishop:2' },
  { name: 'horse', re: /סוס/, where: 'bishop:3' },
  { name: 'rook', re: /צריח/, where: 'rook:intro' },
  { name: 'file', re: /טור/, where: 'rook:intro' },
  { name: 'dragon', re: /דרקון/, where: 'rook:3' },
  { name: 'tokin', re: /טוקין/, where: 'pawn:2' },
  { name: 'capture', re: /לכיד|ללכוד|לוכד|⟦לכוד|לכדת/, where: 'capture:intro' },
  { name: 'threatened', re: /מאוי/, where: 'capture:2' },
  { name: 'nifu', re: /רגלי כפול/, where: 'drop:8' },
  { name: 'protected', re: /מוגן|להגן/, where: 'protection:intro' },
  { name: 'check', re: W('[בלמהו]?שח'), where: 'check1:intro' },
  { name: 'block', re: /חסימ|לחסום|⟦חסום/, where: 'outOfCheck:intro' },
  { name: 'mate', re: W('[בלהו]?מט'), where: 'checkmate1:intro' },
  { name: 'game phases', re: /סוף המשחק|אמצע המשחק/, where: 'checkmate1:intro' },
  { name: 'position', re: /עמדה/, where: 'setup:1' },
  { name: 'repetition', re: /חזרה מרובעת|תיקו/, where: 'repetition:intro' },
];

const EXEMPT: Record<string, string[]> = { 'introduction:1': ['knight', 'lance', 'rook', 'general'] };

function walk() {
  const out: { at: string; text: string }[] = [];
  for (const key of ORDER) {
    const s = stages.find((x) => x.key === key);
    if (!s) continue;
    out.push({ at: `${key}:intro`, text: s.intro });
    s.levels.forEach((l) => out.push({ at: `${key}:${l.id}`, text: [l.goal, l.text ?? '', l.recap ?? ''].join(' ') }));
    out.push({ at: `${key}:complete`, text: s.complete });
  }
  return out;
}

test('no beginner text uses a term before the stage that teaches it', () => {
  const texts = walk();
  for (const t of TERMS) {
    const taught = texts.findIndex((x) => x.at === t.where);
    if (taught < 0) continue;
    for (const x of texts.slice(0, taught))
      if (!EXEMPT[x.at]?.includes(t.name)) expect(t.re.test(x.text), `"${t.name}" used at ${x.at}, taught at ${t.where}: ${x.text}`).toBe(false);
  }
});

test('every term is taught where the list says', () => {
  const texts = walk();
  for (const t of TERMS) {
    const at = texts.find((x) => x.at === t.where);
    if (at) expect(t.re.test(at.text), `${t.name} not found at ${t.where}`).toBe(true);
  }
});

test('no beginner text assumes chess or uses English piece names', () => {
  for (const x of walk()) {
    expect(/שחמט/.test(x.text), `chess at ${x.at}`).toBe(false);
    expect(/\b(King|Rook|Bishop|Gold|Silver|Knight|Lance|Pawn|Black|White)\b/.test(x.text), `English name at ${x.at}`).toBe(false);
  }
});

test('every beginner level has a recap', () => {
  for (const key of ORDER) {
    const s = stages.find((x) => x.key === key);
    if (s) for (const l of s.levels) expect(l.recap || l.why, `${key} #${l.id}`).toBeTruthy();
  }
});
