import { describe, expect, it } from 'vitest';
import { LIMITS, parseFinding, parseReport } from '../src/index.js';
import type { ParseResult } from '../src/index.js';
import { DELETE, patch, validFinding, validReport } from './fixtures.js';
import type { Path } from './fixtures.js';

const FSI = String.fromCodePoint(0x2068);
const RLO = String.fromCodePoint(0x202e);

function issuePaths(result: ParseResult<unknown>): string[] {
  return result.ok ? [] : result.issues.map((issue) => issue.path);
}

const finding = (path: Path, value: unknown) => parseFinding(patch(validFinding(), path, value));
const report = (path: Path, value: unknown) => parseReport(patch(validReport(), path, value));

const base = validReport();
const timedOutRun = {
  module: { id: 'seo.meta', version: '0.1.0' },
  status: 'timed-out',
};

describe('parseReport: valid input', () => {
  it('accepts a complete report', () => {
    expect(parseReport(validReport()).ok).toBe(true);
  });

  it('accepts a later minor version and strips unknown fields', () => {
    let input = patch(validReport(), ['schemaVersion'], '1.4.2');
    input = patch(input, ['futureField'], 'ignored');
    input = patch(input, ['findings', 0, 'futureField'], 'ignored');
    const result = parseReport(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).not.toHaveProperty('futureField');
    expect(result.value.findings[0]).not.toHaveProperty('futureField');
  });

  it('accepts a partial scan with findings only from completed modules', () => {
    let input = patch(base, ['scan', 'status'], 'partial');
    input = patch(input, ['scan', 'modules'], [...base.scan.modules, timedOutRun]);
    expect(parseReport(input).ok).toBe(true);
  });

  it('accepts optional fields being absent', () => {
    const input = patch(validFinding(), ['location'], DELETE);
    expect(parseFinding(patch(input, ['remediation'], DELETE)).ok).toBe(true);
  });
});

describe('parseReport: invalid input', () => {
  it.each([null, undefined, 'report', 42, [], true])('rejects non-object input %j', (input) => {
    expect(parseReport(input).ok).toBe(false);
  });

  it.each(['2.0.0', '0.9.0', '1.0', '1.0.0-beta', '01.0.0'])(
    'rejects unsupported schema version %s',
    (version) => {
      expect(issuePaths(report(['schemaVersion'], version))).toContain('/schemaVersion');
    },
  );

  it('reports a JSON Pointer path and no input values in messages', () => {
    const secret = 'SECRET-VALUE-FROM-SCANNED-SITE';
    const result = report(['findings', 0, 'severity'], secret);
    expect(issuePaths(result)).toEqual(['/findings/0/severity']);
    expect(JSON.stringify(result)).not.toContain(secret);
  });

  it.each([
    ['timestamp with offset', ['scan', 'startedAt'], '2026-11-09T10:00:00+01:00'],
    ['date-only timestamp', ['scan', 'startedAt'], '2026-11-09'],
    ['empty module list', ['scan', 'modules'], []],
    ['unknown module status', ['scan', 'modules', 0, 'status'], 'skipped'],
    ['unknown scan status', ['scan', 'status'], 'done'],
  ] as const)('rejects %s', (_name, path, value) => {
    expect(report(path, value).ok).toBe(false);
  });

  it('rejects finishedAt earlier than startedAt', () => {
    const result = report(['scan', 'finishedAt'], '2026-11-09T09:59:59.000Z');
    expect(issuePaths(result)).toContain('/scan/finishedAt');
  });

  it('rejects a status that does not match module runs', () => {
    const result = report(['scan', 'modules'], [...base.scan.modules, timedOutRun]);
    expect(issuePaths(result)).toContain('/scan/status');
  });

  it('rejects duplicate module runs', () => {
    const result = report(['scan', 'modules'], [...base.scan.modules, ...base.scan.modules]);
    expect(issuePaths(result)).toContain('/scan/modules/1/module/id');
  });

  it.each([
    ['an unknown module', { id: 'other.module', version: '1.0.0' }],
    ['a different module version', { id: 'security.headers', version: '2.0.0' }],
  ])('rejects findings attributed to %s', (_name, module) => {
    expect(issuePaths(report(['findings', 0, 'module'], module))).toContain('/findings/0/module');
  });

  it('rejects findings from a module run that did not complete', () => {
    let input = patch(base, ['scan', 'status'], 'failed');
    input = patch(input, ['scan', 'modules', 0, 'status'], 'failed');
    expect(issuePaths(parseReport(input))).toContain('/findings/0/module');
  });

  it('rejects more findings than the limit', () => {
    const findings = Array.from({ length: LIMITS.findingsPerReport + 1 }, validFinding);
    expect(issuePaths(report(['findings'], findings))).toContain('/findings');
  });
});

describe('parseFinding: invalid input', () => {
  const evidenceItem = { label: 'x', value: 'y', truncated: false };

  it.each([
    ['unknown severity', ['severity'], 'severe'],
    ['missing title', ['title'], DELETE],
    ['empty title', ['title'], ''],
    ['over-long title', ['title'], 'a'.repeat(LIMITS.title + 1)],
    ['uppercase rule id', ['ruleId'], 'Missing-HSTS'],
    ['module id with path characters', ['module', 'id'], '../core'],
    ['non-semver module version', ['module', 'version'], 'latest'],
    ['zero line number', ['location', 'line'], 0],
    ['fractional column', ['location', 'column'], 1.5],
    ['NaN line number', ['location', 'line'], Number.NaN],
    ['explicit undefined optional field', ['location'], undefined],
    ['null optional field', ['remediation'], null],
    ['missing evidence array', ['evidence'], DELETE],
    ['non-boolean truncated flag', ['evidence', 0, 'truncated'], 'no'],
    [
      'too many evidence items',
      ['evidence'],
      Array.from({ length: LIMITS.evidencePerFinding + 1 }, () => evidenceItem),
    ],
    ['over-long evidence value', ['evidence', 0, 'value'], 'a'.repeat(LIMITS.evidenceValue + 1)],
  ] as const)('rejects %s', (_name, path, value) => {
    expect(finding(path, value).ok).toBe(false);
  });
});

describe('parseFinding: untrusted content', () => {
  it.each([
    ['NUL byte', 'a\u0000b'],
    ['escape sequence (terminal injection)', '\u001b[31mred'],
    ['DEL', 'a\u007fb'],
    ['C1 control', 'a\u009bb'],
    ['right-to-left override', `a${RLO}b`],
    ['first strong isolate', `a${FSI}b`],
    ['lone high surrogate', 'a\ud800b'],
    ['lone low surrogate', 'a\udc00b'],
  ])('rejects evidence containing %s', (_name, value) => {
    expect(finding(['evidence', 0, 'value'], value).ok).toBe(false);
  });

  it('rejects unsafe characters in titles too', () => {
    expect(finding(['title'], `ok${RLO}gnp.exe`).ok).toBe(false);
  });

  it('accepts markup, tabs, newlines and non-Latin text as inert plain text', () => {
    const value = '<script>alert(1)</script>\t"quoted"\r\n日本語 🙂';
    const result = finding(['evidence', 0, 'value'], value);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.evidence[0]?.value).toBe(value);
  });

  it('accepts an empty evidence value', () => {
    expect(finding(['evidence', 0, 'value'], '').ok).toBe(true);
  });

  it.each([
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'file:///etc/passwd',
    'ftp://example.com/',
    '//example.com/',
    '/relative/path',
    'https://user:pass@example.com/',
    'https://user@example.com/',
    `https://exa${RLO}mple.com/`,
    `https://example.com/${'a'.repeat(LIMITS.url)}`,
  ])('rejects location URL %s', (url) => {
    expect(finding(['location', 'url'], url).ok).toBe(false);
  });

  it('rejects unsafe reference URLs', () => {
    expect(finding(['references', 0, 'url'], 'javascript:alert(1)').ok).toBe(false);
  });

  it('does not let __proto__ in parsed JSON reach the output or Object.prototype', () => {
    const json = JSON.stringify(validFinding()).replace(
      '{',
      '{"__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}},',
    );
    const result = parseFinding(JSON.parse(json));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.getPrototypeOf(result.value)).toBe(Object.prototype);
    expect(Object.hasOwn(result.value, '__proto__')).toBe(false);
    expect(Object.hasOwn(result.value, 'constructor')).toBe(false);
    expect(Object.hasOwn(Object.prototype, 'polluted')).toBe(false);
  });
});
