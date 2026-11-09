# ADR 0001: Guarded network egress before any network-using module

- **Status:** Accepted
- **Date:** 2026-11-09

## Context

ROADMAP.md originally placed SSRF protection in Phase 3 (External Security Scanner). Phase 2
(SEO Engine), however, includes broken link detection, redirect chain analysis, HTTP status
analysis and crawlability checks. All of these make outbound HTTP requests to URLs that users
supply or that are discovered on scanned pages. SECURITY.md requires scanning to prevent SSRF
and to target only authorized systems.

If Phase 2 modules call `fetch` directly, every module becomes an SSRF vector before Phase 3
adds protection. Adding the guard later would mean finding and rewriting every network call.

Phase 1 does not implement any network access. `core` gives modules no network capability.
`parseHttpUrl` in `shared-types` checks syntax only, and its documentation says it is not SSRF
protection.

## Decision

1. **Schedule.** `net-guard` is the first task of Phase 2. No network-using module may be
   implemented before `net-guard` is implemented, tested and reviewed. ROADMAP.md records this.
   `net-guard` is not implemented in Phase 1.

2. **Separation of responsibilities.**
   - `core` defines the network-client capability: a typed interface exposed to modules
     through `AuditContext`. `core` contains no networking code and does not depend on
     `net-guard`.
   - `net-guard` implements that interface with the guarded networking described below.
   - Whoever composes an audit (CLI, API, tests) supplies the implementation. A module that
     needs network access and receives no client must fail, not fall back.

3. **Single egress path for audit modules.** Every audit module must make outbound requests
   only through the capability in `AuditContext`. Modules must not use `node:http`,
   `node:https`, `node:net`, `node:tls`, `node:dns`, `undici` or the global `fetch`. In this
   repository a lint rule (`no-restricted-imports` / `no-restricted-globals`) enforces this,
   and code review checks it. Third-party modules outside this repository cannot be enforced
   by lint. Documentation must state that they are trusted code.

4. **Fail-closed behavior.**
   - Resolve the hostname and check **every** resolved address. If **any** address is
     prohibited, reject the request. Do not pick a "safe" address from a mixed answer.
   - Reject any address that cannot be classified with certainty: unknown formats, parse
     failures, unexpected address families, or classifier errors.
   - Never fall back to an unguarded request on any error, timeout, unsupported feature or
     configuration problem. An error surfaces as a failed request, and the module run
     records it.

5. **Minimum scope for `net-guard`**, each item with adversarial tests:
   - `http:` and `https:` only. Ports restricted to 80/443 by default, with an explicit
     allowlist.
   - Block loopback, private (RFC 1918, RFC 4193), link-local, CGNAT, multicast, broadcast,
     reserved and documentation ranges, `0.0.0.0/8`, `::`, and cloud metadata addresses
     (`169.254.169.254`, `fd00:ec2::254`, and others).
   - Normalize IPv4-mapped and IPv4-compatible IPv6, NAT64, 6to4 and Teredo addresses before
     classifying them. Reject unusual IPv4 forms (octal, hex, short dotted forms, integer
     forms) by relying on WHATWG URL canonicalization and testing it.
   - **Pin the connection** to the validated address, using a custom `lookup` on the agent or
     dispatcher, so DNS rebinding between check and connect is impossible. Keep TLS SNI and
     certificate checks on the original hostname.
   - Turn off automatic redirects. Re-run the full validation at **every hop**, with a hop
     limit.
   - Connect, header and total timeouts, a response-size limit enforced while streaming, and
     limits on header count and size.
   - Ignore ambient proxy environment variables, or validate the proxy explicitly.

6. **Browser traffic is a separate security boundary.** Browser automation (Playwright,
   Phase 4) opens its own connections: subresources, scripts, redirects, WebSockets and
   service workers. The initial `net-guard` implementation does **not** protect it.
   Browser-based checks need their own control, such as request interception that uses the
   same address classifier, or a network namespace or egress proxy, with their own review and
   tests. Until that exists, documentation must not claim SSRF protection for browser-based
   checks.

## Alternatives considered

| Option                                                                       | Why not chosen                                                                                                                                                       |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Keep SSRF protection in Phase 3, with no network access in Phase 2          | Blocks broken-link, redirect, status and crawlability checks, which is most of technical SEO.                                                                        |
| Each module validates URLs itself                                            | Duplicated, inconsistent and easy to get wrong. Cannot stop DNS rebinding without pinning the connection.                                                            |
| Third-party SSRF library (for example `request-filtering-agent`, `ssrf-req-filter`) | Not rejected outright. Before adoption it must be evaluated for redirect revalidation, connection pinning, IPv6 coverage, fail-closed behavior and maintenance. It would still sit behind the `core` interface. |
| Network-level egress controls only (proxy, firewall, network namespace)     | Strong, but breaks the rule that the core works without extra infrastructure. Recommended as an additional layer for self-hosted deployments, not a replacement.    |

## Security implications

- **Benefits**
  - One choke point for all module egress, enforceable by lint and reviewable in one place.
  - Connection pinning closes the DNS-rebinding window between validation and connection.
  - Revalidating every redirect hop stops open-redirect pivots to internal addresses.
  - Fail-closed defaults mean unknown cases block requests instead of allowing them.
- **Remaining risks**
  - The address classifier is a single point of failure. A wrong range breaks protection for
    every module, so it needs adversarial tests and security review for every change.
  - The lint rule covers only this repository. Third-party modules are trusted code.
  - Browser traffic is unprotected until its own control exists (Decision 6).
  - Response bodies are still untrusted content and must be handled under the report
    contract's untrusted-text rules.
  - Network-level controls on the host remain the operator's responsibility in self-hosted
    deployments.

## Trade-offs

- Phase 2 starts later, with a security-critical component and its tests up front.
- Every network-using module depends on the `core` interface and on a `net-guard`
  implementation being supplied.
- The ROADMAP phase boundary moves: SSRF protection leaves Phase 3.
- Fail-closed behavior will block some legitimate targets, for example hosts whose DNS
  returns both public and private addresses. That is intended. Exceptions require an
  explicit, reviewed allowlist.

## Consequences

- Until `net-guard` is implemented and reviewed, no module may make network requests.
- Changes to the classifier, pinning or redirect handling are security-sensitive and need
  matching adversarial tests (CONTRIBUTING.md, section 7).
