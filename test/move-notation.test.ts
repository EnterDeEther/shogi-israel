import { expect, test } from 'bun:test';
import { localMove } from '../src/lib/move-notation';

test('moves use the letters of the chosen piece set', () => {
  expect(localMove('P-76', 'hebrew')).toBe('ח-76');
  expect(localMove('Bx22+', 'hebrew')).toBe('רץx22+');
  expect(localMove('+R-28', 'hebrew')).toBe('ד-28');
  expect(localMove('S*55', 'kanji')).toBe('銀*55');
  expect(localMove('P-76', 'letters')).toBe('P-76');
});
