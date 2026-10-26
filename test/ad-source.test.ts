import { describe, expect, test } from 'bun:test';
import { parseAdSource } from '../src/lib/ad-source';

describe('parseAdSource', () => {
  test('reads the ad links from the ads plan', () => {
    expect(parseAdSource('?utm_source=google&utm_medium=display&utm_campaign=anime_segment', '/try/')).toEqual({
      source: 'google', medium: 'display', campaign: 'anime_segment', landing: '/try/',
    });
    expect(parseAdSource('?utm_source=google&utm_medium=cpc&utm_campaign=search_chess_bridge&gclid=abc', '/chess/')).toEqual({
      source: 'google', medium: 'cpc', campaign: 'search_chess_bridge', landing: '/chess/',
    });
  });

  test('ignores visits that did not come from an ad', () => {
    expect(parseAdSource('', '/')).toBeNull();
    expect(parseAdSource('?gclid=abc', '/')).toBeNull();
    expect(parseAdSource('?utm_medium=cpc', '/')).toBeNull();
  });

  test('drops values that are not plain campaign names', () => {
    expect(parseAdSource('?utm_source=<script>', '/')).toBeNull();
    expect(parseAdSource('?utm_source=google&utm_campaign=' + 'x'.repeat(41), '/')).toEqual({ source: 'google', landing: '/' });
    expect(parseAdSource('?utm_source=meta&utm_content=a%20b', '/')).toEqual({ source: 'meta', landing: '/' });
  });
});
