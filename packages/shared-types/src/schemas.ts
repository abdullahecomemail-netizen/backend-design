// Internal: Zod schemas are not part of the public API, so the validation library can change
// without breaking consumers. The public contract is the interfaces in contract.ts.
import * as z from 'zod';
import {
  LIMITS,
  MODULE_RUN_STATUSES,
  SCAN_STATUSES,
  SEVERITIES,
  deriveScanStatus,
} from './contract.js';
import type * as Contract from './contract.js';
import { isSafeText, parseHttpUrl } from './text.js';

const UNSAFE_TEXT =
  'must not contain control, bidirectional-override or ill-formed Unicode characters';

function text(max: number, min = 1) {
  return z.string().min(min).max(max).refine(isSafeText, UNSAFE_TEXT);
}

const identifier = z
  .string()
  .max(LIMITS.identifier)
  .regex(
    /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)*$/,
    'must be a dotted lowercase identifier such as "security.headers"',
  );

const semver = z
  .string()
  .max(LIMITS.version)
  .regex(
    /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/,
    'must be a semantic version such as "1.2.3"',
  );

const httpUrl = z
  .string()
  .refine(
    (value) => parseHttpUrl(value) !== undefined,
    'must be an absolute http or https URL without credentials',
  );

const timestamp = z.iso.datetime();

export const moduleIdentitySchema = z.object({
  id: identifier,
  version: semver,
});

const locationSchema = z.object({
  url: httpUrl,
  selector: text(LIMITS.selector).exactOptional(),
  line: z.int().positive().exactOptional(),
  column: z.int().positive().exactOptional(),
});

const evidenceSchema = z.object({
  label: text(LIMITS.label),
  value: text(LIMITS.evidenceValue, 0),
  truncated: z.boolean(),
});

const remediationSchema = z.object({
  summary: text(LIMITS.remediationSummary),
  steps: z.array(text(LIMITS.remediationStep)).max(LIMITS.remediationSteps),
});

const referenceSchema = z.object({ title: text(LIMITS.title), url: httpUrl });

export const findingSchema = z.object({
  module: moduleIdentitySchema,
  ruleId: identifier,
  severity: z.enum(SEVERITIES),
  title: text(LIMITS.title),
  description: text(LIMITS.description),
  location: locationSchema.exactOptional(),
  evidence: z.array(evidenceSchema).max(LIMITS.evidencePerFinding),
  remediation: remediationSchema.exactOptional(),
  references: z.array(referenceSchema).max(LIMITS.referencesPerFinding),
});

const moduleRunSchema = z.object({
  module: moduleIdentitySchema,
  status: z.enum(MODULE_RUN_STATUSES),
});

const scanSchema = z.object({
  target: httpUrl,
  startedAt: timestamp,
  finishedAt: timestamp,
  status: z.enum(SCAN_STATUSES),
  modules: z.array(moduleRunSchema).min(1).max(LIMITS.modulesPerScan),
});

export const reportSchema = z
  .object({
    schemaVersion: z
      .string()
      .regex(
        /^1\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/,
        'unsupported schema version: this reader supports 1.x.y',
      ),
    scan: scanSchema,
    findings: z.array(findingSchema).max(LIMITS.findingsPerReport),
  })
  .superRefine(({ scan, findings }, ctx) => {
    if (Date.parse(scan.finishedAt) < Date.parse(scan.startedAt)) {
      ctx.addIssue({
        code: 'custom',
        path: ['scan', 'finishedAt'],
        message: 'must not be earlier than startedAt',
      });
    }
    if (scan.status !== deriveScanStatus(scan.modules)) {
      ctx.addIssue({
        code: 'custom',
        path: ['scan', 'status'],
        message: 'must match the module run statuses',
      });
    }

    const runs = new Map<string, Contract.ModuleRun>();
    scan.modules.forEach((run, index) => {
      if (runs.has(run.module.id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['scan', 'modules', index, 'module', 'id'],
          message: 'duplicate module id',
        });
      }
      runs.set(run.module.id, run);
    });

    findings.forEach((finding, index) => {
      const run = runs.get(finding.module.id);
      if (run?.status !== 'completed' || run.module.version !== finding.module.version) {
        ctx.addIssue({
          code: 'custom',
          path: ['findings', index, 'module'],
          message: 'must match a completed module run',
        });
      }
    });
  });

// Compile-time proof that validated output satisfies the public contract.
type Conforms<Output, Public> = Output extends Public
  ? Exclude<keyof Public, keyof Output> | Exclude<keyof Output, keyof Public> extends never
    ? true
    : false
  : false;
type Assert<T extends true> = T;
export type ContractConformance = [
  Assert<Conforms<z.output<typeof moduleIdentitySchema>, Contract.ModuleIdentity>>,
  Assert<Conforms<z.output<typeof findingSchema>, Contract.Finding>>,
  Assert<Conforms<z.output<typeof reportSchema>, Contract.Report>>,
  Assert<Conforms<z.output<typeof scanSchema>, Contract.ScanMetadata>>,
  Assert<Conforms<z.output<typeof locationSchema>, Contract.Location>>,
  Assert<Conforms<z.output<typeof evidenceSchema>, Contract.Evidence>>,
  Assert<Conforms<z.output<typeof remediationSchema>, Contract.Remediation>>,
  Assert<Conforms<z.output<typeof referenceSchema>, Contract.Reference>>,
];
