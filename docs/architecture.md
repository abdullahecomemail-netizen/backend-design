# Architecture

This document describes what is implemented today. Planned components are described in
[ROADMAP.md](../ROADMAP.md) and are not implemented until they appear here.

## Packages

```text
packages/
├── shared-types/   @backend-design/shared-types
└── core/           @backend-design/core  (depends on shared-types)
```

Dependencies point toward the contract: `core` depends on `shared-types`, and
`shared-types` depends on nothing in this repository. Future engines (SEO, security,
performance) will depend on `core`. `core` must never depend on them, or on HTTP
frameworks, databases, browsers, cloud providers or dashboard code.

### `@backend-design/shared-types`

The versioned report contract, shared by every producer and consumer: CLI, API, CI
integrations and third-party tools.

- **Public types** (`contract.ts`): `Report`, `ScanMetadata`, `ModuleRun`, `Finding`,
  `ModuleIdentity`, `Severity`, `Location`, `Evidence`, `Remediation`, `Reference`, `Timestamp`.
- **Runtime validation** (`parseReport`, `parseFinding`, `parseModuleIdentity`): validates
  untrusted input and returns `{ ok: true, value }` or `{ ok: false, issues }`. Issues carry
  a JSON Pointer path and a message. They never echo input values.
- **Utilities**: `sanitizeUntrustedText`, `isSafeText`, `parseHttpUrl`, `deriveScanStatus`.
- **Internal**: the Zod schemas in `schemas.ts` are not exported, so the validation library
  can change without breaking consumers. A compile-time check proves the schemas match
  the public interfaces.

### `@backend-design/core`

The framework-independent extension point for audit modules.

- `AuditModule`: `{ identity, run(context) }`. `run` receives a copy of the target URL and an
  `AbortSignal`.
- `runAudit({ target, modules, moduleTimeoutMs?, signal?, onModuleError? })`: runs modules
  sequentially and returns a validated `Report`.

`runAudit` treats module output as untrusted:

- The runner attaches each module's identity, so a module cannot attribute findings to another.
- Every finding is validated. One invalid finding discards that module's whole output
  (`invalid-output`). Partial output is never reported.
- Each module has a time budget (default 30 s). A module that throws, times out or is
  cancelled contributes no findings, and its status is recorded.
- The scan status is `completed` only when every module completed. Otherwise it is `partial`
  or `failed`, so an incomplete scan is never presented as a complete assessment.

Phase 1 gives modules no network capability. See
[ADR 0001](adr/0001-network-egress-guard.md).

## Report contract

`SCHEMA_VERSION` is `1.0.0`. Readers accept any `1.x.y` and drop unknown fields.

| Change                                                      | Version bump |
| ----------------------------------------------------------- | ------------ |
| New optional field                                          | minor        |
| Removed, renamed or retyped field, new required field, stricter limit | major |
| Documentation or message change only                        | patch        |

Contract rules:

- Timestamps are ISO 8601 UTC with a `Z` suffix.
- URLs must be absolute `http:` or `https:` URLs without credentials. This is a syntax check,
  not SSRF protection.
- Optional fields are omitted when absent. An explicit `undefined` or `null` is rejected.
  Lists are always present, possibly empty.
- Every string and list has a size limit (`LIMITS`).
- Findings must belong to a module run with status `completed`. `scan.status` must equal
  `deriveScanStatus(scan.modules)`.

### Untrusted website content

Evidence values and other text may contain content copied from scanned websites. The
contract treats all text as plain, untrusted data:

- Validation rejects C0/C1 control characters (except tab, LF and CR), DEL, bidirectional
  override and isolate characters, and lone surrogates. This blocks terminal escape
  injection and Trojan Source-style display spoofing.
- `sanitizeUntrustedText` converts raw content into a valid value: it replaces unsafe
  characters with U+FFFD, truncates without splitting surrogate pairs, and reports `truncated`.
- Markup such as `<script>` is valid text. Consumers must encode every string for their
  output context and must never render it as HTML or execute it.

## Decisions

- **Modular monolith.** Packages in one repository, without separate services. Packages are
  only created when they have real content.
- **ESM only, Node.js 24+, TypeScript strict** with `exactOptionalPropertyTypes` and
  `noUncheckedIndexedAccess`.
- **Zod 4 for runtime validation.** It is the only runtime dependency. It has no dependencies of
  its own, and keeping it internal keeps the public API independent of it.
- **Turborepo** orders build-dependent tasks (`^build`) and caches results.
- **No dashboard code.** The dashboard is planned in a separate repository and will use
  documented APIs only.
- **Network access** is deferred. See [ADR 0001](adr/0001-network-egress-guard.md).
