import {
  LIMITS,
  SCHEMA_VERSION,
  deriveScanStatus,
  parseFinding,
  parseHttpUrl,
  parseModuleIdentity,
  parseReport,
} from '@backend-design/shared-types';
import type {
  Finding,
  ModuleIdentity,
  ModuleRun,
  ModuleRunStatus,
  Report,
} from '@backend-design/shared-types';
import type { AuditModule } from './module.js';

export const DEFAULT_MODULE_TIMEOUT_MS = 30_000;

export interface RunAuditOptions {
  /** Absolute http(s) URL without credentials. */
  readonly target: string | URL;
  readonly modules: readonly AuditModule[];
  /** Time budget per module. Defaults to `DEFAULT_MODULE_TIMEOUT_MS`. */
  readonly moduleTimeoutMs?: number;
  /** Cancels the audit. Modules not yet finished are reported as `cancelled`. */
  readonly signal?: AbortSignal;
  /** Receives errors thrown by modules, for logging. The report records only the status. */
  readonly onModuleError?: (module: ModuleIdentity, error: unknown) => void;
}

interface ModuleOutcome {
  readonly status: ModuleRunStatus;
  readonly findings: readonly Finding[];
}

/**
 * Runs modules sequentially against one target and returns a validated report.
 * A module that throws, times out, is cancelled or returns invalid output contributes
 * no findings, and the scan status records that the assessment is incomplete.
 */
export async function runAudit(options: RunAuditOptions): Promise<Report> {
  const target = parseHttpUrl(options.target.toString());
  if (target === undefined) {
    throw new TypeError('target must be an absolute http or https URL without credentials');
  }
  const timeoutMs = options.moduleTimeoutMs ?? DEFAULT_MODULE_TIMEOUT_MS;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new RangeError('moduleTimeoutMs must be a positive integer');
  }
  const modules = snapshotModules(options.modules);
  const signal = options.signal ?? new AbortController().signal;

  const startMs = Date.now();
  const runs: ModuleRun[] = [];
  const findings: Finding[] = [];
  for (const { module, identity } of modules) {
    const capacity = LIMITS.findingsPerReport - findings.length;
    const outcome = await runModule(module, identity, target, signal, timeoutMs, capacity, options);
    runs.push({ module: identity, status: outcome.status });
    findings.push(...outcome.findings);
  }

  const report: Report = {
    schemaVersion: SCHEMA_VERSION,
    scan: {
      target: target.href,
      startedAt: new Date(startMs).toISOString(),
      // Guard against the wall clock moving backwards during the scan.
      finishedAt: new Date(Math.max(Date.now(), startMs)).toISOString(),
      status: deriveScanStatus(runs),
      modules: runs,
    },
    findings,
  };
  const checked = parseReport(report);
  if (!checked.ok) {
    throw new Error('internal error: generated report failed contract validation');
  }
  return checked.value;
}

function snapshotModules(modules: readonly AuditModule[]) {
  if (modules.length === 0) throw new RangeError('at least one audit module is required');
  if (modules.length > LIMITS.modulesPerScan) {
    throw new RangeError(`at most ${String(LIMITS.modulesPerScan)} audit modules are allowed`);
  }
  const seen = new Set<string>();
  return modules.map((module) => {
    // Copy the identity once so a module cannot change it while the audit runs.
    const parsed = parseModuleIdentity({
      id: module.identity.id,
      version: module.identity.version,
    });
    if (!parsed.ok) throw new TypeError('invalid audit module identity');
    if (seen.has(parsed.value.id)) {
      throw new TypeError(`duplicate audit module id: ${parsed.value.id}`);
    }
    seen.add(parsed.value.id);
    return { module, identity: parsed.value };
  });
}

async function runModule(
  module: AuditModule,
  identity: ModuleIdentity,
  target: URL,
  cancel: AbortSignal,
  timeoutMs: number,
  capacity: number,
  options: RunAuditOptions,
): Promise<ModuleOutcome> {
  if (cancel.aborted) return { status: 'cancelled', findings: [] };

  const timeout = AbortSignal.timeout(timeoutMs);
  const signal = AbortSignal.any([cancel, timeout]);
  let output: unknown;
  try {
    output = await untilAborted(
      Promise.resolve().then(() => module.run({ target: new URL(target.href), signal })),
      signal,
    );
  } catch (error) {
    if (signal.aborted) {
      // AbortSignal.any() takes the reason of whichever source aborted first.
      const status = signal.reason === timeout.reason ? 'timed-out' : 'cancelled';
      return { status, findings: [] };
    }
    options.onModuleError?.(identity, error);
    return { status: 'failed', findings: [] };
  }

  const findings = validateOutput(output, identity, capacity);
  return findings === undefined
    ? { status: 'invalid-output', findings: [] }
    : { status: 'completed', findings };
}

/** Returns undefined when any item is invalid: partial module output is never reported. */
function validateOutput(
  output: unknown,
  identity: ModuleIdentity,
  capacity: number,
): Finding[] | undefined {
  try {
    if (!Array.isArray(output) || output.length > capacity) return undefined;
    const findings: Finding[] = [];
    for (const item of output as unknown[]) {
      if (typeof item !== 'object' || item === null) return undefined;
      const parsed = parseFinding({ ...item, module: identity });
      if (!parsed.ok) return undefined;
      findings.push(parsed.value);
    }
    return findings;
  } catch {
    // Hostile output, such as a throwing getter or proxy.
    return undefined;
  }
}

/**
 * Settles with the promise, or rejects as soon as the signal aborts. A module that ignores
 * its signal keeps running in the background, but its result is discarded.
 */
function untilAborted<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      reject(new Error('aborted', { cause: signal.reason }));
    };
    if (signal.aborted) {
      onAbort();
      return;
    }
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener('abort', onAbort);
        reject(error instanceof Error ? error : new Error('module rejected', { cause: error }));
      },
    );
  });
}
