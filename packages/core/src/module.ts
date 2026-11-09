import type { Finding, ModuleIdentity } from '@backend-design/shared-types';

/**
 * A finding as returned by a module. The runner attaches the module identity itself,
 * so a module cannot report findings on behalf of another module.
 */
export type ModuleFinding = Omit<Finding, 'module'>;

export interface AuditContext {
  /** The validated http(s) target. Each module receives its own copy. */
  readonly target: URL;
  /** Aborted when the audit is cancelled or the module exceeds its time budget. Stop work promptly. */
  readonly signal: AbortSignal;
}

/**
 * The extension point for audit modules (SEO, security, performance, ...).
 *
 * Phase 1 gives modules no network capability. Guarded networking
 * is planned for Phase 2 under accepted ADR docs/adr/0001-network-egress-guard.md.
 * Until then, modules must not make outbound requests.
 */
export interface AuditModule {
  readonly identity: ModuleIdentity;
  /** Output is treated as untrusted and validated against the report contract. */
  run(context: AuditContext): Promise<readonly ModuleFinding[]>;
}
