import { afterEach, describe, expect, test } from 'bun:test';
import { DESKTOP_SETTINGS, PHONE_SETTINGS, settingsHref } from '../src/lib/settings-place';

const g = globalThis as Record<string, unknown>;

function device(matches: string[], standalone = false) {
  g.matchMedia = (q: string) => ({ matches: matches.includes(q) });
  g.navigator = { standalone };
}

afterEach(() => { delete g.matchMedia; delete g.navigator; });

describe('settingsHref', () => {
  test('computer gets the desktop page', () => {
    device(['(pointer: fine)']);
    expect(settingsHref()).toBe(DESKTOP_SETTINGS);
  });
  test('touch phone or tablet gets the app settings', () => {
    device(['(pointer: coarse)']);
    expect(settingsHref()).toBe(PHONE_SETTINGS);
  });
  test('installed app gets the app settings', () => {
    device(['(display-mode: standalone)']);
    expect(settingsHref()).toBe(PHONE_SETTINGS);
  });
  test('iPhone home-screen app gets the app settings', () => {
    device([], true);
    expect(settingsHref()).toBe(PHONE_SETTINGS);
  });
});
