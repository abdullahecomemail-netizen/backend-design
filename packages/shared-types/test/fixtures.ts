import type { Finding, Report } from '../src/index.js';

export function validFinding(): Finding {
  return {
    module: { id: 'security.headers', version: '1.0.0' },
    ruleId: 'missing-hsts',
    severity: 'medium',
    title: 'Strict-Transport-Security header is missing',
    description: 'The response does not set HSTS.\nBrowsers may connect over plain HTTP.',
    location: { url: 'https://example.com/', line: 1, column: 1 },
    evidence: [
      {
        label: 'Response headers',
        value: 'content-type: text/html',
        truncated: false,
      },
    ],
    remediation: {
      summary: 'Send an HSTS header.',
      steps: ['Configure the web server.'],
    },
    references: [{ title: 'RFC 6797', url: 'https://www.rfc-editor.org/rfc/rfc6797' }],
  };
}

export function validReport(): Report {
  return {
    schemaVersion: '1.0.0',
    scan: {
      target: 'https://example.com/',
      startedAt: '2026-11-09T10:00:00.000Z',
      finishedAt: '2026-11-09T10:00:05.000Z',
      status: 'completed',
      modules: [
        {
          module: { id: 'security.headers', version: '1.0.0' },
          status: 'completed',
        },
      ],
    },
    findings: [validFinding()],
  };
}

export const DELETE = Symbol('delete');
export type Path = readonly (string | number)[];

/** Returns a deep copy of `base` with the value at `path` replaced, or removed for `DELETE`. */
export function patch(base: unknown, path: Path, value: unknown): unknown {
  const copy: unknown = structuredClone(base);
  const keys = [...path];
  const last = keys.pop();
  if (last === undefined) throw new Error('path must not be empty');
  let node = copy as Record<string | number, unknown>;
  for (const key of keys) node = node[key] as Record<string | number, unknown>;
  if (value === DELETE) Reflect.deleteProperty(node, last);
  else node[last] = value;
  return copy;
}
