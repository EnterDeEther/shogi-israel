import { describe, expect, test } from 'bun:test';
import { describe as describeBoard, handLabel, parseSfen, squareLabel } from '../src/lib/sfen';

const pos = parseSfen('9/9/3r1b3/9/9/9/9/9/4K4 b Np 1');
const at = (id: string) => pos.squares.find((s) => s.id === id)!;

describe('board words', () => {
  test('course boards speak to the reader', () => {
    expect(handLabel('sente', true)).toBe('ביד שלך');
    expect(handLabel('gote', true)).toBe('ביד של היריב');
    expect(describeBoard(pos, true)).toEqual([
      'הכלים שלך: מלך ב־59.',
      'הכלים של היריב: צריח ב־63; רץ ב־43.',
      'ביד שלך: פרש.',
      'ביד של היריב: חייל.',
    ]);
    expect(squareLabel(at('59'), true)).toBe('משבצת 59, מלך שלך');
    expect(squareLabel(at('63'), true)).toBe('משבצת 63, צריח של היריב');
  });

  test('other boards keep the players\' names', () => {
    expect(handLabel('sente')).toBe('ביד של הפותח');
    expect(handLabel('gote')).toBe('ביד של המשיב');
    expect(describeBoard(pos)).toEqual([
      'הפותח: מלך ב־59.',
      'המשיב: צריח ב־63; רץ ב־43.',
      'ביד של הפותח: פרש.',
      'ביד של המשיב: חייל.',
    ]);
    expect(squareLabel(at('59'))).toBe('משבצת 59, מלך של הפותח');
    expect(squareLabel(at('55'))).toBe('משבצת 55, ריקה');
  });
});
