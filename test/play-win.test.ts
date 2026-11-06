import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const view = readFileSync(new URL('../src/play/view.ts', import.meta.url), 'utf8');

describe('play end screen', () => {
  test('signed-out players get the account line and a button', () => {
    expect(view).toContain("'data-signed-out-only': ''");
    expect(view).toContain('בחשבון חינמי הרמה שהגעת אליה והמשחקים שלך נשמרים, בכל מכשיר.');
    expect(view).toContain("'פתיחת חשבון בחינם'");
    expect(view).not.toContain('⟦פתח|פתחי⟧ חשבון בחינם');
  });

  test('chess-symbol players get the chess page link unless the course has a next step', () => {
    expect(view).toContain('nextInCourse() ?? chessLink()');
    expect(view).toContain("currentPieceSet() !== 'chess'");
    expect(view).toContain("'לעמוד לשחקני שחמט'");
    expect(view).toContain("href: '/chess/'");
  });
});
