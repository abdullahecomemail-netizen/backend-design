# Contributing to BACKEND DESIGN

First of all, thank you for your interest in contributing to BACKEND DESIGN.

BACKEND DESIGN is an open-source website engineering platform focused on security, SEO, performance optimization, and continuous website monitoring.

We welcome developers, security researchers, engineers, technical writers, and open-source enthusiasts who want to help build better website infrastructure.

Our goal is to create software that developers can trust, use, improve, and contribute to worldwide.

## 1. Our Engineering Principles

Every contribution should follow these principles:

- Security comes first.
- Code must be maintainable and reusable.
- Functionality must be tested.
- Documentation must remain accurate.
- Performance should not be unnecessarily compromised.
- Dependencies should be carefully evaluated.
- Features should solve real problems.
- Existing functionality must not break.

We prioritize quality, reliability, and security over unnecessary complexity.

## 2. What You Can Contribute

We welcome contributions across all areas of the project.

### Security

- Security middleware improvements.
- Vulnerability detection.
- Security configuration checks.
- API protection.
- Authentication and authorization improvements.
- Dependency security.
- Security testing.
- Documentation improvements.

### SEO

- Technical SEO auditing.
- Metadata generation.
- Structured data.
- Sitemap generation.
- Broken link detection.
- Backlink monitoring integrations.
- SEO performance improvements.

### Performance

- Core Web Vitals analysis.
- Image optimization recommendations.
- Caching improvements.
- Resource optimization.
- Performance monitoring.
- Benchmarking.

### Core Engineering

- TypeScript improvements.
- API development.
- Architecture improvements.
- Testing infrastructure.
- Bug fixes.
- Developer experience.

### Documentation

- Installation guides.
- Tutorials.
- API documentation.
- Examples.
- Architecture documentation.
- Troubleshooting guides.

## 3. Before You Start

Before contributing:

1. Read the project README.
2. Review SECURITY.md.
3. Check the existing issues.
4. Look at open pull requests.
5. Understand the relevant package architecture.

For substantial changes, open an issue or discussion first to avoid duplicated work.

## 4. Development Setup

The project uses a TypeScript-based development environment.

Expected tooling includes:

- Node.js (supported LTS version).
- pnpm.
- Git.
- TypeScript.
- Docker where required by the development environment.

Clone the repository:

```bash
git clone https://github.com/YOUR_USERNAME/backend-design.git

cd backend-design
```

Install dependencies after the project package configuration has been established:

```bash
pnpm install
```

Run the available development scripts documented in the relevant package.

Note: Commands may change during early development. Follow the current README and package documentation.

## 5. Branch Naming

Use descriptive branch names.

Examples:

```text
feature/security-headers
feature/seo-auditor
feature/performance-monitoring
fix/ssrf-validation
fix/metadata-generation
docs/installation-guide
test/security-middleware
```

Avoid vague names such as:

```text
update
changes
new-code
test123
```

## 6. Coding Standards

All contributions should follow these guidelines:

- Use TypeScript wherever appropriate.
- Follow strict TypeScript configuration.
- Avoid unnecessary use of `any`.
- Use descriptive variable and function names.
- Keep functions focused and reusable.
- Avoid unnecessary dependencies.
- Follow established project architecture.
- Handle errors consistently.
- Avoid exposing internal implementation details.
- Add comments where they genuinely improve understanding.

Do not introduce breaking changes without documenting them.

## 7. Security Requirements

Security-sensitive contributions receive additional scrutiny.

Every security-related contribution must consider:

- Authentication.
- Authorization.
- Input validation.
- Output handling.
- Access control.
- Data exposure.
- Error handling.
- Abuse scenarios.
- Dependency risks.
- Logging and monitoring.

Never:

- Commit API keys or credentials.
- Introduce hardcoded passwords.
- Store plaintext passwords.
- Disable security checks to make tests pass.
- Introduce unsafe default configurations.
- Expose sensitive user information.
- Add undocumented external network calls.

All security changes should include appropriate tests.

Security vulnerabilities must be reported privately according to SECURITY.md.

Do not publish exploitable vulnerability details in public issues or pull requests.

## 8. Testing Requirements

New functionality must include relevant tests.

Before submitting a pull request, run the available project checks.

Typical commands may include:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Only run commands that exist in the current project configuration.

Contributors must not claim that tests pass unless they have actually executed them.

Bug fixes should include regression tests wherever practical.

Security-related changes must include tests for relevant attack scenarios and failure cases.

## 9. Commit Messages

Use clear and descriptive commit messages.

Suggested prefixes:

```text
feat: add security header middleware
fix: prevent unsafe redirect handling
docs: improve installation guide
test: add API security tests
refactor: simplify SEO auditing
chore: update dependencies
```

Keep commits focused on logically related changes.

## 10. Pull Request Guidelines

Before opening a pull request:

- Ensure your branch is up to date.
- Run relevant tests.
- Run linting and type checks.
- Update documentation.
- Review your changes for secrets and sensitive information.
- Explain the purpose of your contribution.

A good pull request should include:

1. A clear title.
2. A description of the problem.
3. What was changed.
4. Why the change is necessary.
5. Relevant testing information.
6. Screenshots where applicable.
7. Potential breaking changes.

Pull requests may require changes before approval.

Maintainers reserve the right to request additional tests, documentation, or architectural improvements.

## 11. Breaking Changes

Changes that affect public APIs, package interfaces, configuration formats, or existing integrations must be documented.

Breaking changes should:

- Explain the impact.
- Include migration instructions.
- Update relevant documentation.
- Include appropriate versioning.
- Receive maintainer review.

Avoid breaking existing integrations unnecessarily.

## 12. Dependencies

Before adding a new dependency:

- Evaluate whether it is necessary.
- Check maintenance activity.
- Review its security history.
- Review its license.
- Consider bundle size and performance.
- Avoid packages with unnecessary permissions or functionality.

Prefer established and maintained libraries.

## 13. Code of Conduct

All contributors are expected to:

- Be respectful.
- Communicate professionally.
- Welcome different experience levels.
- Provide constructive feedback.
- Avoid harassment or discrimination.
- Respect maintainers and other contributors.

We want BACKEND DESIGN to be an inclusive and productive open-source community.

## 14. License

By submitting contributions, you agree that your contributions will be distributed under the project's Apache License 2.0, subject to its terms.

You confirm that you have the right to submit the code and documentation you contribute.

## 15. Our Vision

BACKEND DESIGN is being built to make website infrastructure more secure, accessible, and maintainable.

We want developers around the world to contribute to software that helps websites become:

- More secure.
- Better optimized for search engines.
- Faster and smoother.
- Easier to monitor.
- Easier to maintain.

Every meaningful contribution helps move this mission forward.

**Thank you for helping build BACKEND DESIGN.**

Security by design. Protection by default. Built for developers.
