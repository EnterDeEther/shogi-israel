import { expect, test } from 'bun:test';
import { localMove } from '../src/lib/move-notation';

test('moves use the letters of the chosen piece set', () => {
  expect(localMove('P-76', 'hebrew')).toBe('ח-76');
  expect(localMove('Bx22+', 'hebrew')).toBe('רץx22+');
  expect(localMove('+R-28', 'hebrew')).toBe('ד-28');
  expect(localMove('S*55', 'kanji')).toBe('銀*55');
  expect(localMove('P-76', 'letters')).toBe('P-76');
  expect(localMove('G49-58', 'hebrew')).toBe('ז-49-58');
  expect(localMove('S38x27+', 'hebrew')).toBe('כ-38x27+');
  expect(localMove('G49-58', 'kanji')).toBe('金-49-58');
  expect(localMove('G49-58', 'letters')).toBe('G49-58');
  expect(localMove('P*55', 'hebrew')).toBe('ח*55');
});
