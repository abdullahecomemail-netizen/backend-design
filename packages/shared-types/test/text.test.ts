import { describe, expect, it } from 'vitest';
import {
  LIMITS,
  deriveScanStatus,
  isSafeText,
  parseHttpUrl,
  sanitizeUntrustedText,
} from '../src/index.js';

describe('sanitizeUntrustedText', () => {
  it('keeps safe text unchanged', () => {
    expect(sanitizeUntrustedText('line 1\n\tline 2 <b>日本</b> 🙂')).toEqual({
      value: 'line 1\n\tline 2 <b>日本</b> 🙂',
      truncated: false,
    });
  });

  it('replaces control, bidirectional and ill-formed characters with U+FFFD', () => {
    const result = sanitizeUntrustedText('a\u0000b\u001b[0mc\u202ed\u2066e\ud800f\u009bg');
    expect(result.value).toBe('a\uFFFDb\uFFFD[0mc\uFFFDd\uFFFDe\uFFFDf\uFFFDg');
    expect(isSafeText(result.value)).toBe(true);
  });

  it('truncates to the evidence limit by default', () => {
    const result = sanitizeUntrustedText('a'.repeat(LIMITS.evidenceValue + 10));
    expect(result.truncated).toBe(true);
    expect(result.value).toHaveLength(LIMITS.evidenceValue);
  });

  it('does not split a surrogate pair when truncating', () => {
    const result = sanitizeUntrustedText('ab🙂', 3);
    expect(result).toEqual({ value: 'ab', truncated: true });
    expect(isSafeText(result.value)).toBe(true);
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects maxLength %s',
    (maxLength) => {
      expect(() => sanitizeUntrustedText('a', maxLength)).toThrow(RangeError);
    },
  );
});

describe('parseHttpUrl', () => {
  it.each(['http://example.com', 'https://example.com:8443/path?q=1#x', 'https://例え.jp/'])(
    'accepts %s',
    (input) => {
      expect(parseHttpUrl(input)).toBeInstanceOf(URL);
    },
  );

  it.each([
    '',
    'example.com',
    'javascript:alert(1)',
    'JAVASCRIPT:alert(1)',
    'file:///C:/Windows/win.ini',
    'ws://example.com/',
    'https://trusted.example@evil.example/',
    'https://user@example.com/',
    'https://a\u0000b.com/',
  ])('rejects %j', (input) => {
    expect(parseHttpUrl(input)).toBeUndefined();
  });
});

describe('deriveScanStatus', () => {
  it.each([
    [['completed', 'completed'], 'completed'],
    [['completed', 'timed-out'], 'partial'],
    [['failed', 'cancelled'], 'failed'],
  ] as const)('%j -> %s', (statuses, expected) => {
    expect(deriveScanStatus(statuses.map((status) => ({ status })))).toBe(expected);
  });
});
