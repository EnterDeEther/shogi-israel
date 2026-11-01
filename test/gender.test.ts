import { describe, expect, test } from 'bun:test';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { genderHtml, resolve, TOKEN } from '../src/lib/gender';

describe('resolve', () => {
  test('picks each form', () => {
    expect(resolve('⟦לחץ|לחצי⟧ על ⟦אתה|את⟧', 'm')).toBe('לחץ על אתה');
    expect(resolve('⟦לחץ|לחצי⟧ על ⟦אתה|את⟧', 'f')).toBe('לחצי על את');
  });
  test('masculine by default, text without tokens unchanged', () => {
    expect(resolve('⟦נסה|נסי⟧ שוב')).toBe('נסה שוב');
    expect(resolve('בלי טוקנים', 'f')).toBe('בלי טוקנים');
  });
});

describe('genderHtml', () => {
  test('text becomes both forms in spans', () => {
    expect(genderHtml('<p>⟦נסה|נסי⟧ שוב</p>')).toBe('<p><span class="gm">נסה</span><span class="gf">נסי</span> שוב</p>');
  });
  test('shown attributes take the masculine form and keep both in data-g-*', () => {
    expect(genderHtml('<div aria-label="⟦בחר|בחרי⟧ תשובה" class="x">')).toBe('<div aria-label="בחר תשובה" class="x" data-g-aria-label="⟦בחר|בחרי⟧ תשובה">');
  });
  test('other attributes and raw-text elements take the masculine form', () => {
    expect(genderHtml('<meta content="⟦נסה|נסי⟧ שוגי">')).toBe('<meta content="נסה שוגי">');
    expect(genderHtml('<script>const t = "⟦נסה|נסי⟧";</script>')).toBe('<script>const t = "נסה";</script>');
    expect(genderHtml('<option>⟦בחר|בחרי⟧</option>')).toBe('<option>בחר</option>');
  });
  test('the title keeps both forms for the page script', () => {
    expect(genderHtml('<title>⟦יודע|יודעת⟧ שחמט?</title>')).toBe('<title data-g="⟦יודע|יודעת⟧ שחמט?">יודע שחמט?</title>');
  });
});

describe('tokens in the source', () => {
  test('every ⟦ opens a well-formed token', () => {
    const files = execSync('git ls-files src api supabase', { encoding: 'utf8' }).split('\n')
      .filter((f) => /\.(astro|ts|mdx|json|html)$/.test(f) && !f.includes('tsume/data') && !f.endsWith('lib/gender.ts'));
    for (const f of files) {
      const s = readFileSync(f, 'utf8').replace(TOKEN, '');
      expect({ f, left: s.includes('⟦') || s.includes('⟧') }).toEqual({ f, left: false });
    }
  });
});
