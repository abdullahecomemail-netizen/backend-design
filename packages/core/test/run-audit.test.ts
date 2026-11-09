import { describe, expect, it, vi } from 'vitest';
import { parseReport } from '@backend-design/shared-types';
import type { ModuleIdentity } from '@backend-design/shared-types';
import { runAudit } from '../src/index.js';
import type { AuditContext, AuditModule, ModuleFinding } from '../src/index.js';

const RLO = String.fromCodePoint(0x202e);

const TARGET = 'https://example.com/';

const finding: ModuleFinding = {
  ruleId: 'missing-hsts',
  severity: 'medium',
  title: 'HSTS is missing',
  description: 'The response does not set Strict-Transport-Security.',
  evidence: [],
  references: [],
};

function makeModule(
  id: string,
  run: (context: AuditContext) => Promise<readonly ModuleFinding[]>,
): AuditModule {
  return { identity: { id, version: '1.0.0' }, run };
}

const returns =
  (...findings: unknown[]) =>
  () =>
    Promise.resolve(findings as ModuleFinding[]);
const never = () => new Promise<never>(() => undefined);

function statuses(report: Awaited<ReturnType<typeof runAudit>>) {
  return report.scan.modules.map((run) => run.status);
}

describe('runAudit', () => {
  it('produces a valid completed report and attaches module identity', async () => {
    const report = await runAudit({
      target: TARGET,
      modules: [
        makeModule('security.headers', returns(finding)),
        makeModule('seo.meta', returns()),
      ],
    });

    expect(parseReport(report).ok).toBe(true);
    expect(report.scan.status).toBe('completed');
    expect(report.scan.target).toBe(TARGET);
    expect(statuses(report)).toEqual(['completed', 'completed']);
    expect(report.findings).toHaveLength(1);
    expect(report.findings[0]?.module).toEqual({
      id: 'security.headers',
      version: '1.0.0',
    });
  });

  it('overrides a module identity supplied inside a finding', async () => {
    const spoofed = {
      ...finding,
      module: { id: 'other.module', version: '9.9.9' },
    };
    const report = await runAudit({
      target: TARGET,
      modules: [makeModule('security.headers', returns(spoofed))],
    });
    expect(report.findings[0]?.module.id).toBe('security.headers');
  });

  it('gives each module its own target copy and an abort signal', async () => {
    const seen: string[] = [];
    const mutate = makeModule('a.mutate', (context) => {
      expect(context.signal).toBeInstanceOf(AbortSignal);
      context.target.hostname = 'evil.example';
      return Promise.resolve([]);
    });
    const observe = makeModule('b.observe', (context) => {
      seen.push(context.target.href);
      return Promise.resolve([]);
    });
    await runAudit({ target: TARGET, modules: [mutate, observe] });
    expect(seen).toEqual([TARGET]);
  });

  it('records a rejecting module as failed, reports the error, and continues', async () => {
    const onModuleError = vi.fn<(module: ModuleIdentity, error: unknown) => void>();
    const report = await runAudit({
      target: TARGET,
      onModuleError,
      modules: [
        makeModule('a.broken', () => Promise.reject(new Error('boom'))),
        makeModule('b.ok', returns(finding)),
      ],
    });
    expect(statuses(report)).toEqual(['failed', 'completed']);
    expect(report.scan.status).toBe('partial');
    expect(report.findings.map((f) => f.module.id)).toEqual(['b.ok']);
    expect(onModuleError).toHaveBeenCalledOnce();
    expect(onModuleError.mock.calls[0]?.[0]).toEqual({
      id: 'a.broken',
      version: '1.0.0',
    });
  });

  it('records a module that throws synchronously as failed', async () => {
    const report = await runAudit({
      target: TARGET,
      modules: [
        makeModule('a.sync', () => {
          throw new Error('sync boom');
        }),
      ],
    });
    expect(statuses(report)).toEqual(['failed']);
    expect(report.scan.status).toBe('failed');
  });

  it('times out a module that ignores its signal and discards its output', async () => {
    const report = await runAudit({
      target: TARGET,
      moduleTimeoutMs: 20,
      modules: [makeModule('a.hang', never), makeModule('b.ok', returns())],
    });
    expect(statuses(report)).toEqual(['timed-out', 'completed']);
    expect(report.scan.status).toBe('partial');
  });

  it('marks the running and remaining modules cancelled when the caller aborts', async () => {
    const controller = new AbortController();
    const started = vi.fn();
    const report = await runAudit({
      target: TARGET,
      signal: controller.signal,
      modules: [
        makeModule('a.ok', returns(finding)),
        makeModule('b.slow', () => {
          controller.abort();
          return never();
        }),
        makeModule('c.never-started', () => {
          started();
          return Promise.resolve([]);
        }),
      ],
    });
    expect(statuses(report)).toEqual(['completed', 'cancelled', 'cancelled']);
    expect(started).not.toHaveBeenCalled();
    expect(report.findings).toHaveLength(1);
  });

  it.each([
    ['a non-array', () => Promise.resolve('not an array' as unknown as ModuleFinding[])],
    ['a null item', returns(null)],
    ['an invalid severity', returns({ ...finding, severity: 'severe' })],
    [
      'unsafe evidence text',
      returns({
        ...finding,
        evidence: [{ label: 'x', value: RLO, truncated: false }],
      }),
    ],
    [
      'a throwing getter',
      returns(
        Object.defineProperty({ ...finding }, 'title', {
          enumerable: true,
          get() {
            throw new Error('hostile');
          },
        }),
      ),
    ],
  ])('rejects all output from a module returning %s', async (_name, run) => {
    const report = await runAudit({
      target: TARGET,
      modules: [makeModule('a.bad', returns(finding, finding)), makeModule('b.bad', run)],
    });
    expect(statuses(report)).toEqual(['completed', 'invalid-output']);
    expect(report.findings.every((f) => f.module.id === 'a.bad')).toBe(true);
  });

  it.each([
    'javascript:alert(1)',
    'file:///etc/passwd',
    'https://user:pass@example.com/',
    'not a url',
  ])('rejects target %s before running modules', async (target) => {
    const run = vi.fn(returns());
    await expect(runAudit({ target, modules: [makeModule('a.ok', run)] })).rejects.toThrow(
      TypeError,
    );
    expect(run).not.toHaveBeenCalled();
  });

  it('accepts a URL object as target', async () => {
    const report = await runAudit({
      target: new URL(TARGET),
      modules: [makeModule('a.ok', returns())],
    });
    expect(report.scan.target).toBe(TARGET);
  });

  it.each([
    ['no modules', { modules: [] }],
    ['a zero timeout', { moduleTimeoutMs: 0 }],
    ['a fractional timeout', { moduleTimeoutMs: 1.5 }],
  ])('rejects %s', async (_name, overrides) => {
    await expect(
      runAudit({
        target: TARGET,
        modules: [makeModule('a.ok', returns())],
        ...overrides,
      }),
    ).rejects.toThrow(RangeError);
  });

  it('rejects duplicate and malformed module identities', async () => {
    await expect(
      runAudit({
        target: TARGET,
        modules: [makeModule('a.ok', returns()), makeModule('a.ok', returns())],
      }),
    ).rejects.toThrow(/duplicate/);
    await expect(
      runAudit({
        target: TARGET,
        modules: [makeModule('../Bad Id', returns())],
      }),
    ).rejects.toThrow(/identity/);
  });
});
