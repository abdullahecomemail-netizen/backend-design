import { LIMITS } from './contract.js';

// C0 controls except tab/LF/CR, DEL, C1 controls, and bidirectional embedding, override and
// isolate characters, which can make displayed text differ from its logical order (CVE-2021-42574).
// Built from numeric code points so the source never contains the characters themselves.
const UNSAFE_RANGES = [
  [0x00, 0x08],
  [0x0b, 0x0c],
  [0x0e, 0x1f],
  [0x7f, 0x9f],
  [0x202a, 0x202e],
  [0x2066, 0x2069],
] as const;
const UNSAFE_CLASS = `[${UNSAFE_RANGES.map(
  ([from, to]) => `\\u{${from.toString(16)}}-\\u{${to.toString(16)}}`,
).join('')}]`;
const UNSAFE_CHARS = new RegExp(UNSAFE_CLASS, 'u');
const UNSAFE_CHARS_GLOBAL = new RegExp(UNSAFE_CLASS, 'gu');

/** True when `value` is well-formed Unicode with no unsafe control or bidirectional characters. */
export function isSafeText(value: string): boolean {
  return value.isWellFormed() && !UNSAFE_CHARS.test(value);
}

export interface SanitizedText {
  readonly value: string;
  readonly truncated: boolean;
}

/**
 * Converts untrusted text, such as content copied from a scanned website, into a bounded value
 * that passes contract validation. Unsafe characters and lone surrogates become U+FFFD.
 * This does not make the text safe to render as markup: consumers must still encode it.
 */
export function sanitizeUntrustedText(
  input: string,
  maxLength: number = LIMITS.evidenceValue,
): SanitizedText {
  if (!Number.isSafeInteger(maxLength) || maxLength < 1) {
    throw new RangeError('maxLength must be a positive integer');
  }
  const cleaned = input.toWellFormed().replace(UNSAFE_CHARS_GLOBAL, '�');
  if (cleaned.length <= maxLength) return { value: cleaned, truncated: false };

  // Do not cut a surrogate pair in half.
  const last = cleaned.charCodeAt(maxLength - 1);
  const end = last >= 0xd800 && last <= 0xdbff ? maxLength - 1 : maxLength;
  return { value: cleaned.slice(0, end), truncated: true };
}

/**
 * Parses an absolute http or https URL without embedded credentials.
 * This is a syntax check only. It is NOT SSRF protection: it does not inspect hosts,
 * IP addresses, ports, DNS or redirects.
 */
export function parseHttpUrl(input: string): URL | undefined {
  if (input.length > LIMITS.url || !isSafeText(input)) return undefined;
  const url = URL.parse(input);
  if (url === null) return undefined;
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
  if (url.username !== '' || url.password !== '') return undefined;
  return url;
}
