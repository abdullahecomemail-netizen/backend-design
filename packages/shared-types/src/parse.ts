import type * as z from 'zod';
import type { Finding, ModuleIdentity, Report } from './contract.js';
import { findingSchema, moduleIdentitySchema, reportSchema } from './schemas.js';

export interface ValidationIssue {
  /** JSON Pointer (RFC 6901) to the invalid value, for example `/findings/0/title`. */
  readonly path: string;
  readonly message: string;
}

export type ParseResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly issues: readonly ValidationIssue[] };

const MAX_ISSUES = 100;

function pointer(path: readonly PropertyKey[]): string {
  return path.map((key) => '/' + String(key).replaceAll('~', '~0').replaceAll('/', '~1')).join('');
}

function validate<T>(schema: z.ZodType<T>, input: unknown): ParseResult<T> {
  const result = schema.safeParse(input);
  if (result.success) return { ok: true, value: result.data };
  return {
    ok: false,
    issues: result.error.issues
      .slice(0, MAX_ISSUES)
      .map((issue) => ({ path: pointer(issue.path), message: issue.message })),
  };
}

/**
 * Validates untrusted input, such as parsed JSON, against the report contract.
 * Unknown fields are removed. Validation messages never include input values.
 */
export function parseReport(input: unknown): ParseResult<Report> {
  return validate(reportSchema, input);
}

export function parseFinding(input: unknown): ParseResult<Finding> {
  return validate(findingSchema, input);
}

export function parseModuleIdentity(input: unknown): ParseResult<ModuleIdentity> {
  return validate(moduleIdentitySchema, input);
}
