# ts-template

Opinionated TypeScript repository template, modeled on the toolchain used by
[dyoshikawa/rulesync](https://github.com/dyoshikawa/rulesync).

## What's included

| Area              | Tool                                                                              | Config                                                      |
| ----------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Runtime / tooling | [mise](https://mise.jdx.dev/)                                                     | `mise.toml`                                                 |
| Package manager   | [pnpm](https://pnpm.io/)                                                          | `pnpm-workspace.yaml`, `.npmrc`                             |
| Language          | [TypeScript](https://www.typescriptlang.org/)                                     | `tsconfig.json`                                             |
| Build             | [tsdown](https://tsdown.dev/)                                                     | `tsdown.config.ts`                                          |
| Test              | [Vitest](https://vitest.dev/)                                                     | `vitest.config.ts`                                          |
| Format            | [oxfmt](https://oxc.rs/)                                                          | `.oxfmtrc.json`                                             |
| Lint              | [oxlint](https://oxc.rs/)                                                         | `.oxlintrc.json`                                            |
| Unused code       | [knip](https://knip.dev/)                                                         | `knip.ts`                                                   |
| Spelling          | [cspell](https://cspell.org/)                                                     | `cspell.json`                                               |
| Secret scanning   | [secretlint](https://github.com/secretlint/secretlint)                            | `.secretlintrc.json`                                        |
| Git hooks         | [simple-git-hooks](https://github.com/toplenboren/simple-git-hooks) + lint-staged | `package.json`, `.lintstagedrc.js`                          |
| AI rules          | [rulesync](https://github.com/dyoshikawa/rulesync)                                | `rulesync.jsonc`, `.rulesync/`                              |
| Workflow lint     | [actionlint](https://github.com/rhysd/actionlint)                                 | `.github/workflows/actionlint.yml`                          |
| Action pinning    | [pinact](https://github.com/suzuki-shunsuke/pinact)                               | `.pinact.yaml`, `.github/workflows/pinact.yml`              |
| Image scan        | [Trivy](https://trivy.dev/)                                                       | `.trivyignore`, `.github/workflows/trivy-security-scan.yml` |
| Dev environment   | Dev Container                                                                     | `.devcontainer/`                                            |
| Dependency bumps  | Dependabot                                                                        | `.github/dependabot.yml`                                    |
| CI / Release      | GitHub Actions                                                                    | `.github/workflows/ci.yml`, `publish.yml`                   |

## Getting started

```bash
mise install       # install node, pnpm, actionlint, pinact
pnpm install       # install dependencies and set up the pre-commit hook
pnpm cicheck       # run everything CI runs
```

Then rename the project:

1. `package.json` — `name`, `description`, `keywords`, `homepage`, `bugs`, `repository`
2. `README.md` — this file
3. `LICENSE` — copyright holder, if it isn't you
4. `.github/dependabot.yml` — `assignees`
5. `.rulesync/rules/overview.md` — the project overview handed to AI coding agents
6. `src/index.ts` — replace the sample export

## Scripts

| Script                 | Description                                               |
| ---------------------- | --------------------------------------------------------- |
| `pnpm build`           | Build ESM + CJS bundles and type declarations into `dist` |
| `pnpm check`           | `fmt:check` + `oxlint` + `typecheck`                      |
| `pnpm cicheck`         | `cicheck:code` + `cicheck:content` — what CI runs         |
| `pnpm cicheck:code`    | `check` + `test`                                          |
| `pnpm cicheck:content` | `cspell` + `secretlint`                                   |
| `pnpm fix`             | Auto-fix formatting and lint problems                     |
| `pnpm generate`        | Regenerate AI tool configs from `.rulesync/`              |
| `pnpm knip`            | Report unused files, exports, and dependencies            |
| `pnpm test`            | Run the test suite                                        |
| `pnpm test:coverage`   | Run the test suite with coverage                          |
| `pnpm typecheck`       | Type-check without emitting                               |

## mise tasks

| Task                    | Description                                      |
| ----------------------- | ------------------------------------------------ |
| `mise run actionlint`   | Lint GitHub Actions workflows                    |
| `mise run pinact`       | Pin actions in workflows to full commit SHAs     |
| `mise run pinact:check` | Fail if any action is not pinned to a commit SHA |

## Supply chain hardening

- `.npmrc` sets `save-exact=true`, so every dependency is pinned to an exact version.
- `pnpm-workspace.yaml` sets `minimumReleaseAge: 1440`, so a version published less than a day ago is
  refused — a compromised release has time to be pulled before it reaches a lockfile.
- Postinstall scripts are blocked by default via `allowBuilds`; add a package there only when a build
  step is genuinely required. CI installs with `--ignore-scripts`.
- Every third-party GitHub Action is pinned to a full-length commit SHA, enforced by `pinact` in CI.
- Workflows declare the narrowest `permissions:` block they need.
- `secretlint` runs over every staged file through lint-staged, and over the whole tree in CI.
- Trivy scans the devcontainer Dockerfile for misconfigurations on every change, failing on
  `CRITICAL`/`HIGH`. Findings that are intentional go in `.trivyignore` with a reason.
- The devcontainer installs [Safe Chain](https://github.com/AikidoSec/safe-chain) so npm/pnpm
  installs inside it are screened for known-malicious packages.

## Dev Container

`.devcontainer/` builds a sandbox image (`node:26` + zsh/oh-my-zsh, mise, gh, ripgrep, delta) where
the AI coding agents can run with relaxed permissions without touching the host:

- `mise install` runs at build time from the repo's `mise.toml`, so node, pnpm, actionlint and pinact
  are present in the image. **Changing `mise.toml` requires rebuilding the container.**
- Claude Code, Codex CLI (version-pinned with a SHA256-checked installer) and OpenCode are installed.
- `node_modules`, the pnpm store, the bash history and `~/.claude` live in named volumes, so they
  survive rebuilds and don't collide with the host.
- API keys are passed in from the host through `TS_TEMPLATE_DEVCONTAINER_*` environment variables —
  rename that prefix per project, and export only the keys you actually use.
- `postCreateCommand` runs `.devcontainer/init.sh`: it fixes volume ownership, configures the git
  credential helper when GitHub credentials exist, points pnpm at the store volume, and installs
  dependencies.

## AI coding agent rules

Rules live in `.rulesync/` and are compiled into each tool's native format by `pnpm generate`:

- `.rulesync/rules/*.md` — instructions (overview, coding, testing, GitHub Actions security)
- `.rulesync/mcp.json` — MCP servers
- `.rulesync/hooks.json` — session hooks
- `.rulesync/permissions.jsonc` — per-tool permission settings
- `rulesync.jsonc` — which tools to generate for (Claude Code, Codex CLI, GitHub Copilot, opencode)

Generated files (`AGENTS.md`, `CLAUDE.md`, `.claude/`, `.github/instructions/`, …) are gitignored —
edit `.rulesync/**` instead, never the generated output.

## Publishing

`.github/workflows/publish.yml` publishes to npm when a `v*.*.*` tag is pushed. It verifies the tag
matches `package.json`'s version, runs `pnpm cicheck`, builds, and publishes via
[npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers) (OIDC — no npm token in secrets).
Configure the trusted publisher on npm before the first release, or delete the workflow if the
package is not published.

## License

[MIT](./LICENSE)
