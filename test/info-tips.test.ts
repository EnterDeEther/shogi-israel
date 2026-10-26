import { describe, expect, test } from 'bun:test';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { TIPS, tipMarkup, type TipId } from '../src/lib/info-tips';

const ids = Object.keys(TIPS) as TipId[];

/** The label, the text and the link question: everything a visitor or a screen reader meets. */
const allText = (id: TipId): string[] => {
  const t = TIPS[id] as { label: string; text: string; more?: { text: string } };
  return [t.label, t.text, ...(t.more ? [t.more.text] : [])];
};

const sources = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? sources(p) : /\.(astro|ts)$/.test(f) ? [p] : [];
  });

// the file a site link points at, and whether the #anchor is in it
function resolve(href: string): { file: string | null; anchor: string | null } {
  const [path, anchor = null] = href.split('#');
  const clean = path.replace(/^\/|\/$/g, '');
  const lesson = clean.match(/^rules\/(.+)$/);
  const candidates = lesson
    ? [`src/content/rules/${lesson[1]}.mdx`]
    : [`src/pages/${clean}.astro`, `src/pages/${clean}/index.astro`];
  return { file: candidates.find((c) => existsSync(c)) ?? null, anchor };
}

describe('tip texts', () => {
  test('each tip has a label, a short text and a link that is a question', () => {
    for (const id of ids) {
      const t = TIPS[id] as { label: string; text: string; more?: { href: string; text: string } };
      expect(t.label.length).toBeGreaterThan(2);
      expect(t.text.split(/\s+/).length).toBeLessThanOrEqual(36);
      expect(t.text.length).toBeGreaterThan(40);
      if (t.more) expect(t.more.text.endsWith('?')).toBe(true);
    }
  });

  test('Hebrew typography as on the rest of the site: geresh and maqaf, no straight quotes', () => {
    for (const id of ids) {
      const t = TIPS[id] as { label: string; text: string; more?: { text: string } };
      for (const s of [t.label, t.text, t.more?.text ?? '']) {
        expect(s).not.toMatch(/['"]/);
        expect(s).not.toMatch(/ב-\d/); // "ב־3", not "ב-3"
      }
    }
  });

  test('glossary terms, and no "טיפ" (that is the lesson coach)', () => {
    for (const id of ids) {
      for (const s of allText(id)) {
        expect(s).not.toMatch(/טיפ/);
        expect(s).not.toMatch(/לקיחה|לוקחים|מסע/);
      }
    }
  });

  // The site speaks to one man in the singular (אתה, שלך, "בחר"), never a plural used to avoid gender, and the
  // footer carries the one disclaimer. A Hebrew letter on either side means a different word, so the check is on whole words.
  test('masculine singular: no plural "you" and no impersonal plural where אתה fits', () => {
    const word = (list: string) => new RegExp(`(^|[^א-ת])[ובלמכשה]{0,2}(?:${list})(?![א-ת])`);
    const pluralYou = word('אתם|אתן|שלכם|שלכן|לכם|בכם|אתכם|אותכם|מכם|עליכם|אליכם|איתכם|תוכלו|תוכלי|לחצו|בחרו|נסו|הקישו|גללו|פתחו|סגרו|שימו|שחקו|קראו|ראו|זכרו|שמרו|שלחו');
    const impersonal = word('בוחרים|מקבלים|צוברים|רואים|לומדים|סופרים|מגיעים|מסדרים|קוראים|יכולים');
    for (const id of ids) {
      for (const s of allText(id)) {
        expect({ id, s, plural: pluralYou.test(s) }).toEqual({ id, s, plural: false });
        expect({ id, s, impersonal: impersonal.test(s) }).toEqual({ id, s, impersonal: false });
      }
    }
  });

  test('the tips that talk to the reader say אתה or שלך, not a form for both genders', () => {
    for (const id of ids) {
      for (const s of allText(id)) {
        expect(s).not.toMatch(/[א-ת]\([א-ת]{1,2}\)|[א-ת]\/[א-ת]/); // "עשה/י", "בחר(י)"
      }
    }
    expect(TIPS.rank.text).toContain('שלך');
    expect(TIPS.points.text).toContain('אתה');
  });

  test('every link goes to a page or lesson that exists, and to an anchor that exists', () => {
    for (const id of ids) {
      const more = (TIPS[id] as { more?: { href: string } }).more;
      if (!more) continue;
      const { file, anchor } = resolve(more.href);
      expect(file).not.toBeNull();
      if (anchor) expect(readFileSync(file!, 'utf8')).toContain(`id="${anchor}"`);
    }
  });
});

describe('tip markup', () => {
  test('a button and a popover that point at each other', () => {
    for (const id of ids) {
      const html = tipMarkup(id, 'tip-x1');
      expect(html).toContain('<button type="button" class="info-tip__btn" popovertarget="tip-x1" aria-expanded="false"');
      expect(html).toContain(`aria-label="הסבר קצר: ${TIPS[id].label}"`);
      expect(html).toContain('id="tip-x1" popover="auto"');
      expect(html).toContain(TIPS[id].text);
    }
  });

  test('every tip on a page gets its own id', () => {
    const a = tipMarkup('rank');
    const b = tipMarkup('rank');
    const idOf = (h: string) => h.match(/id="(tip-[a-z0-9]+)"/)![1];
    expect(idOf(a)).not.toBe(idOf(b));
  });

  test('spans and buttons only, so a tip can sit inside a paragraph; no inline style (the CSP)', () => {
    for (const id of ids) {
      const html = tipMarkup(id);
      expect(html).not.toMatch(/<(div|p|ul|li|h\d)\b/);
      expect(html).not.toContain('style=');
      expect(html).not.toMatch(/\son\w+=/);
      for (const tag of ['span', 'button']) {
        expect((html.match(new RegExp(`<${tag}\\b`, 'g')) ?? []).length).toBe((html.match(new RegExp(`</${tag}>`, 'g')) ?? []).length);
      }
    }
  });
});

describe('where tips are used', () => {
  const files = sources('src').filter((f) => !f.endsWith('info-tips.ts') && !f.endsWith('info-tip-dom.ts'));
  const used: { id: string; file: string; at: number }[] = [];
  for (const f of files) {
    const text = readFileSync(f, 'utf8');
    for (const m of text.matchAll(/<InfoTip id="(\w+)"|tipEl\('(\w+)'\)|, '(sides)'\)/g)) {
      used.push({ id: m[1] ?? m[2] ?? m[3], file: f, at: m.index! });
    }
    // PieceToggle tip: the component picks the id itself
    if (f.endsWith('PieceToggle.astro')) used.push({ id: 'pieces', file: f, at: 0 });
  }

  test('only tips that exist, and every tip is used somewhere', () => {
    for (const u of used) expect(ids).toContain(u.id as TipId);
    for (const id of ids) expect(used.some((u) => u.id === id)).toBe(true);
  });

  test('never inside a link, a button or a summary (they cannot hold another control)', () => {
    for (const u of used.filter((x) => x.file.endsWith('.astro'))) {
      const before = readFileSync(u.file, 'utf8').slice(0, u.at);
      for (const tag of ['a', 'button', 'summary']) {
        const opened = [...before.matchAll(new RegExp(`<${tag}[\\s>]`, 'g'))].length;
        const closed = [...before.matchAll(new RegExp(`</${tag}>`, 'g'))].length;
        // a tag opened and not yet closed before the tip would contain it
        expect({ file: u.file, tag, open: opened > closed }).toEqual({ file: u.file, tag, open: false });
      }
    }
  });
});
