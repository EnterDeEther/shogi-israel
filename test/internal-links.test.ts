import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';

const dir = new URL('../src/content/rules/', import.meta.url);

describe('lesson links', () => {
  test('internal page links end with a slash', () => {
    const bad: string[] = [];
    for (const f of readdirSync(dir)) {
      const text = readFileSync(new URL(f, dir), 'utf8');
      for (const m of text.matchAll(/\]\((\/[^)\s]*)\)/g)) {
        const path = m[1].split(/[?#]/)[0];
        if (!path.endsWith('/') && !/\.[a-z0-9]+$/i.test(path)) bad.push(`${f}: ${m[1]}`);
      }
    }
    expect(bad).toEqual([]);
  });
});
