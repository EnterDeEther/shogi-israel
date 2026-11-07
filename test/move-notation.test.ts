import { expect, test } from 'bun:test';
import { lessonMove, localMove } from '../src/lib/move-notation';

test('moves use the letters of the chosen piece set', () => {
  expect(localMove('P-76', 'hebrew')).toBe('ח-76');
  expect(localMove('Bx22+', 'hebrew')).toBe('רץ×22+');
  expect(localMove('+R-28', 'hebrew')).toBe('ד-28');
  expect(localMove('S*55', 'kanji')).toBe('銀*55');
  expect(localMove('P-76', 'letters')).toBe('P-76');
  expect(localMove('Bx22+', 'letters')).toBe('Bx22+');
  expect(localMove('G49-58', 'hebrew')).toBe('ז-49-58');
  expect(localMove('S38x27+', 'hebrew')).toBe('כ-38×27+');
  expect(localMove('G49-58', 'kanji')).toBe('金-49-58');
  expect(localMove('G49-58', 'letters')).toBe('G49-58');
  expect(localMove('P*55', 'hebrew')).toBe('ח*55');
  expect(localMove('S-48=', 'hebrew')).toBe('כ-48=');
});

test('outside lessons the chess set keeps western letters', () => {
  expect(localMove('Rx24', 'chess')).toBe('Rx24');
});

test('lesson text converts every move and leaves other text alone', () => {
  expect(lessonMove('המהלכים: P-76, P-26, R-68.', 'hebrew')).toBe('המהלכים: ח-76, ח-26, צ-68.');
  expect(lessonMove('Rx24', 'chess')).toBe('♜︎×24');
  expect(lessonMove('+R-28', 'chess')).toBe('+♜︎-28');
  expect(lessonMove('טור 2, שורה 6', 'hebrew')).toBe('טור 2, שורה 6');
  expect(lessonMove('P-76', 'letters')).toBe('P-76');
});
