/**
 * Public report contract, schema version 1.
 *
 * Compatibility rules for `schemaVersion` (`MAJOR.MINOR.PATCH`):
 * - MINOR: additive changes only, such as new optional fields. Readers ignore unknown fields.
 * - MAJOR: removals, renames, type changes, new required fields or stricter limits.
 * - PATCH: documentation or validation-message changes with no shape change.
 */
export const SCHEMA_VERSION = '1.0.0';

export const SEVERITIES = ['critical', 'high', 'medium', 'low', 'info'] as const;
export type Severity = (typeof SEVERITIES)[number];

/** Outcome of running one audit module. Only `completed` means the module's checks were performed. */
export const MODULE_RUN_STATUSES = [
  'completed',
  'failed',
  'timed-out',
  'cancelled',
  'invalid-output',
] as const;
export type ModuleRunStatus = (typeof MODULE_RUN_STATUSES)[number];

/**
 * `completed`: every module completed. `partial`: some modules did not complete.
 * `failed`: no module completed. A partial scan must never be presented as a complete assessment.
 */
export const SCAN_STATUSES = ['completed', 'partial', 'failed'] as const;
export type ScanStatus = (typeof SCAN_STATUSES)[number];

/** Size limits enforced by validation. Strings are measured in UTF-16 code units. */
export const LIMITS = {
  identifier: 100,
  version: 64,
  url: 4096,
  title: 300,
  label: 200,
  description: 5000,
  selector: 1024,
  evidenceValue: 4096,
  remediationSummary: 2000,
  remediationStep: 1000,
  remediationSteps: 50,
  evidencePerFinding: 20,
  referencesPerFinding: 20,
  modulesPerScan: 200,
  findingsPerReport: 10_000,
} as const;

/** ISO 8601 UTC timestamp with a `Z` suffix, for example `2026-11-09T10:00:00.000Z`. */
export type Timestamp = string;

/** Identifies the audit module that produced a result. */
export interface ModuleIdentity {
  /** Dotted lowercase identifier, for example `security.headers`. */
  readonly id: string;
  /** Semantic version of the module implementation, for example `1.0.0`. */
  readonly version: string;
}

/** Where a finding was observed. */
export interface Location {
  /** Absolute http(s) URL without credentials. */
  readonly url: string;
  /** CSS selector or similar locator inside the document. */
  readonly selector?: string;
  /** 1-based line number. */
  readonly line?: number;
  /** 1-based column number. */
  readonly column?: number;
}

/**
 * Supporting evidence for a finding. `value` may contain content copied from a scanned website.
 * It is untrusted plain text, never markup: consumers must encode it for their output context
 * (HTML, terminal, Markdown, logs) and must never render, evaluate or execute it.
 */
export interface Evidence {
  readonly label: string;
  readonly value: string;
  /** True when `value` was shortened to fit `LIMITS.evidenceValue`. */
  readonly truncated: boolean;
}

export interface Remediation {
  readonly summary: string;
  readonly steps: readonly string[];
}

export interface Reference {
  readonly title: string;
  /** Absolute http(s) URL without credentials. */
  readonly url: string;
}

export interface Finding {
  readonly module: ModuleIdentity;
  /** Dotted lowercase rule identifier, stable across module versions. */
  readonly ruleId: string;
  readonly severity: Severity;
  readonly title: string;
  readonly description: string;
  readonly location?: Location;
  readonly evidence: readonly Evidence[];
  readonly remediation?: Remediation;
  readonly references: readonly Reference[];
}

export interface ModuleRun {
  readonly module: ModuleIdentity;
  readonly status: ModuleRunStatus;
}

export interface ScanMetadata {
  /** Absolute http(s) URL without credentials. */
  readonly target: string;
  readonly startedAt: Timestamp;
  readonly finishedAt: Timestamp;
  /** Always equal to `deriveScanStatus(modules)`. */
  readonly status: ScanStatus;
  readonly modules: readonly ModuleRun[];
}

export interface Report {
  readonly schemaVersion: string;
  readonly scan: ScanMetadata;
  /** Findings from completed module runs only. */
  readonly findings: readonly Finding[];
}

export function deriveScanStatus(runs: readonly Pick<ModuleRun, 'status'>[]): ScanStatus {
  const completed = runs.filter((run) => run.status === 'completed').length;
  if (completed === runs.length) return 'completed';
  return completed === 0 ? 'failed' : 'partial';
}
