# Development Guide

## Requirements

- Node.js 24 or later. Node.js 26 is the primary development version (see `.node-version`).
- pnpm, at the exact version pinned in the `packageManager` field of `package.json`.
- Git.

No database, cache, browser, cloud account or paid service is needed.

## Installing pnpm

Use one of these methods:

- **Corepack**, bundled with Node.js 24 but no longer bundled with Node.js 25 and later.
  Run `corepack enable pnpm`. This installs shims next to the Node.js binary and may need
  administrator rights. To avoid that, run `corepack enable --install-directory <dir> pnpm`
  and add `<dir>` to your `PATH`. Corepack then uses the version pinned in `package.json`.
- **Standalone or npm install**, following https://pnpm.io/installation. Install the pinned version.

## Install dependencies

```bash
pnpm install
```

The lockfile is committed. CI installs with `pnpm install --frozen-lockfile`. pnpm refuses
package versions published less than 7 days ago (`minimumReleaseAge` in `pnpm-workspace.yaml`).
This reduces exposure to compromised releases.

## Scripts

Run from the repository root:

| Command             | What it does                                                        |
| ------------------- | ------------------------------------------------------------------- |
| `pnpm build`        | Compiles every package to `dist/` with `tsc`.                       |
| `pnpm typecheck`    | Type-checks sources and tests in every package.                     |
| `pnpm lint`         | Runs ESLint (`typescript-eslint` strict, type-checked rules).       |
| `pnpm test`         | Runs Vitest unit tests in every package.                            |
| `pnpm format`       | Formats code and config files with Prettier.                        |
| `pnpm format:check` | Fails if any file is not formatted.                                 |
| `pnpm check`        | Runs format check, lint, typecheck, tests and build, in that order. |

Turborepo orders these tasks. It builds `@backend-design/shared-types` first, because the
other packages consume its compiled output. Markdown files are not formatted by Prettier.

## Continuous integration

`.github/workflows/ci.yml` runs on every push to `main` and every pull request:

- **check** (Node.js 24 and 26): frozen-lockfile install, a Trojan Source guard that rejects
  bidirectional control characters in tracked files, format check, lint, typecheck, tests, build.
- **audit**: `pnpm audit --audit-level moderate`. Accepted advisories are listed with their
  reasons under `auditConfig.ignoreGhsas` in `pnpm-workspace.yaml`.

Workflow permissions are read-only (`contents: read`). Third-party actions are pinned to full
commit SHAs. Dependabot proposes updates for actions and npm packages weekly, after a 7-day
cooldown.

## Versioning

- Packages follow Semantic Versioning and start at `0.1.0`. While a package is `0.x`, minor
  versions may contain breaking changes, which must be documented.
- All packages are `private: true`. Nothing is published to npm yet.
- The report contract has its own `SCHEMA_VERSION`, independent of package versions. See
  [architecture.md](architecture.md#report-contract).
