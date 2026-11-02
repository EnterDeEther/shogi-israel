import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { offerOnPage } from '../src/lib/install';
import { APP_GATE, gateAllows } from '../src/lib/app-lock';
import { APP_TOUR, isTourId, readTourEnd, writeTourEnd } from '../src/lib/tour';

const src = (p: string) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');

describe('install offer pages', () => {
  test('stays off the first step and every board', () => {
    for (const p of ['/try/', '/try/pieces/', '/play/', '/play/x/', '/kif/', '/clock/', '/learn/rook/', '/rules/1/', '/tsume/3/']) expect(offerOnPage(p)).toBe(false);
  });
  test('shows on content pages', () => {
    for (const p of ['/', '/course/', '/learn/', '/rules/', '/tsume/', '/chess/', '/about/', '/app/', '/account/']) expect(offerOnPage(p)).toBe(true);
  });
  test('says the app needs an account', () => {
    expect(src('components/InstallOffer.astro')).toContain('עם חשבון');
    expect(src('components/InstallWarning.astro')).toContain('האפליקציה דורשת חשבון');
  });
});

describe('app gate', () => {
  const here = `https://shogi.co.il${APP_GATE}`;
  test('only the gate itself, privacy and mail stay reachable', () => {
    expect(gateAllows('/account/?mode=signup', here)).toBe('stay');
    expect(gateAllows('#emails', here)).toBe('stay');
    expect(gateAllows('mailto:contact@shogi.co.il', here)).toBe('stay');
    expect(gateAllows('/privacy/', here)).toBe('privacy');
    expect(gateAllows('/privacy/#emails', here)).toBe('privacy');
    for (const h of ['/', '/app/', '/try/', '/play/', '/ranks/#site', 'https://www.instagram.com/shogi.israel/', '//evil.example/']) expect(gateAllows(h, here)).toBe('block');
  });
  test('the head script locks every page before paint', () => {
    const base = src('layouts/Base.astro');
    expect(base).toContain("location.replace(gate)");
    expect(base.indexOf('app-locked')).toBeLessThan(base.indexOf('<body>'));
  });
  test('the gate hides the header, menu, footer and offers', () => {
    const css = src('styles/global.css');
    for (const sel of ['.site-header', '.site-footer', '.install-offer', '.tour-card']) expect(css).toContain(`html.app-locked ${sel}`);
  });
});

describe('app tour', () => {
  test('walks the course, the game, the settings, the menu and the shortcuts', () => {
    expect(APP_TOUR.steps.map((s) => s.target)).toEqual(['app-course', 'app-play', 'app-settings', 'settings', 'quick']);
    expect(APP_TOUR.intro.body(5).startsWith('חמישה צעדים')).toBe(true);
    expect(isTourId('app')).toBe(true);
  });
  test('every step has its hook on the page', () => {
    const page = src('pages/app.astro') + src('components/Header.astro');
    for (const s of APP_TOUR.steps) expect(page).toContain(`data-tour="${s.target}"`);
  });
  test('is remembered apart from the other tours', () => {
    const m = new Map<string, string>();
    const s = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
    writeTourEnd(s, 'done', 'site');
    expect(readTourEnd(s, 'app')).toBeNull();
    writeTourEnd(s, 'skipped', 'app');
    expect(readTourEnd(s, 'app')).toBe('skipped');
  });
});
