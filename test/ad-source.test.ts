import { describe, expect, test } from 'bun:test';
import { parseAdSource } from '../src/lib/ad-source';

describe('parseAdSource', () => {
  test('reads the utm parameters of an ad link', () => {
    expect(parseAdSource('?utm_source=google&utm_medium=display&utm_campaign=display_a', '/try/')).toEqual({
      source: 'google', medium: 'display', campaign: 'display_a', landing: '/try/',
    });
    expect(parseAdSource('?utm_source=google&utm_medium=cpc&utm_campaign=search_a&gclid=abc', '/chess/')).toEqual({
      source: 'google', medium: 'cpc', campaign: 'search_a', landing: '/chess/',
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
