# ts-template

Opinionated TypeScript web app template: [TanStack Start](https://tanstack.com/start) (React) on
[Cloudflare Workers](https://developers.cloudflare.com/workers/), with passwordless email sign-in,
an installable PWA and Web Push notifications — on the toolchain used by
[dyoshikawa/rulesync](https://github.com/dyoshikawa/rulesync).

## Features

- **Email sign-in** — [Better Auth](https://www.better-auth.com/) with the email OTP plugin: enter an
  address, receive a 6-digit code (sent through Cloudflare Email Service), enter it. First-time
  addresses are registered on the spot; `ALLOWED_EMAILS` can restrict who may sign in.
  [Turnstile](https://developers.cloudflare.com/turnstile/) guards the mailer and account deletion.
  Accounts can be closed from the account page, deleting every row of the user. Sessions last 90
  days and slide forward while the user keeps coming back; sign-in requests are rate-limited in D1
  (off for local runs), keyed by the client address Cloudflare reports (`CF-Connecting-IP`).
- **PWA** — web app manifest, icons (drawn by `scripts/generate-icons.mjs`), and a service worker
  (`public/sw.js`) that caches the hashed assets and serves an offline page.
- **Install button** — fires the browser's own install dialog where one is offered (Chrome, Edge,
  Samsung Internet), and shows the "Add to Home Screen" steps on iOS and on phones whose browser
  offers none. Hidden once the app runs installed.
- **Push notifications** — Web Push implemented on WebCrypto alone (`src/lib/web-push.ts`: RFC 8291
  payload encryption and RFC 8292 VAPID), so it runs in a Worker without Node's `crypto`. Devices
  subscribe from the account page; `notifyUser` (`src/lib/push.ts`) sends to all of a user's devices
  and drops subscriptions the push service reports gone. On iOS/iPadOS 16.4+ pushes reach apps added
  to the Home Screen only.
- **Phone first, dark mode** — 44 px tap targets, 16 px inputs, `dark:` variants throughout.
- **Security headers** on every page and API response (`src/lib/security-headers.ts`).

## What's included

| Area              | Tool                                                                                                           | Config                                                      |
| ----------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Framework         | [TanStack Start](https://tanstack.com/start) + [React](https://react.dev/)                                     | `vite.config.ts`, `src/router.tsx`, `src/routes/`           |
| Styling           | [Tailwind CSS v4](https://tailwindcss.com/)                                                                    | `src/styles.css`                                            |
| Hosting           | [Cloudflare Workers](https://developers.cloudflare.com/workers/) (D1, Email Service, Rate Limiting, Turnstile) | `wrangler.jsonc`, `src/server.ts`                           |
| Auth              | [Better Auth](https://www.better-auth.com/) (email OTP)                                                        | `src/lib/auth.ts`                                           |
| Database          | [Drizzle ORM](https://orm.drizzle.team/) on D1                                                                 | `src/db/schema.ts`, `drizzle/`, `drizzle.config.ts`         |
| Runtime / tooling | [mise](https://mise.jdx.dev/)                                                                                  | `mise.toml`                                                 |
| Package manager   | [pnpm](https://pnpm.io/)                                                                                       | `pnpm-workspace.yaml`, `.npmrc`                             |
| Language          | [TypeScript](https://www.typescriptlang.org/)                                                                  | `tsconfig.json`                                             |
| Unit tests        | [Vitest](https://vitest.dev/) + Testing Library                                                                | `vitest.config.ts`                                          |
| Browser tests     | [Playwright](https://playwright.dev/) against the built Worker in the Cloudflare emulator                      | `playwright.config.ts`, `e2e/`                              |
| Format            | [oxfmt](https://oxc.rs/)                                                                                       | `.oxfmtrc.json`                                             |
| Lint              | [oxlint](https://oxc.rs/)                                                                                      | `.oxlintrc.json`                                            |
| Unused code       | [knip](https://knip.dev/)                                                                                      | `knip.ts`                                                   |
| Spelling          | [cspell](https://cspell.org/)                                                                                  | `cspell.json`                                               |
| Secret scanning   | [secretlint](https://github.com/secretlint/secretlint)                                                         | `.secretlintrc.json`                                        |
| Git hooks         | [simple-git-hooks](https://github.com/toplenboren/simple-git-hooks) + lint-staged                              | `package.json`, `.lintstagedrc.js`                          |
| AI rules          | [rulesync](https://github.com/dyoshikawa/rulesync)                                                             | `rulesync.jsonc`, `.rulesync/`                              |
| Workflow lint     | [actionlint](https://github.com/rhysd/actionlint)                                                              | `.github/workflows/actionlint.yml`                          |
| Action pinning    | [pinact](https://github.com/suzuki-shunsuke/pinact)                                                            | `.pinact.yaml`, `.github/workflows/pinact.yml`              |
| Image scan        | [Trivy](https://trivy.dev/)                                                                                    | `.trivyignore`, `.github/workflows/trivy-security-scan.yml` |
| Dev environment   | Dev Container                                                                                                  | `.devcontainer/`                                            |
| Dependency bumps  | Dependabot                                                                                                     | `.github/dependabot.yml`                                    |
| CI / Deploy       | GitHub Actions                                                                                                 | `.github/workflows/ci.yml`, `deploy.yml`                    |

## Getting started

```bash
mise install       # install node, pnpm, actionlint, pinact
pnpm install       # install dependencies and set up the pre-commit hook
pnpm db:migrate:local
pnpm dev           # http://localhost:5173 — the sign-in code is printed in the terminal
pnpm cicheck       # run everything CI runs (plus `pnpm e2e` for the browser tests)
```

`pnpm dev` runs Vite's dev server: no email is sent (the code is logged) and Turnstile uses
Cloudflare's always-passing test keys. The service worker — and so install and push notifications —
only runs in the built app: `pnpm dev:cf` builds it and serves it in the Cloudflare emulator (workerd)
at `http://localhost:4173` with a local D1. Copy `.dev.vars.example` to `.dev.vars` for local
variables; `pnpm dev:cf --vars .dev.vars.e2e` switches Turnstile off and fixes the sign-in code to
`123456`.

Then rename the project:

1. `package.json` — `name`, `description`, `keywords`, `homepage`, `bugs`, `repository`
2. `src/lib/app.ts` — `APP_NAME`
3. `wrangler.jsonc` — `name`, `database_name`, and the `vars` (`wrangler.example.jsonc` shows a filled-in one)
4. `public/manifest.webmanifest`, `public/offline.html`, `public/sw.js` — the name, colors and cache names
5. `scripts/generate-icons.mjs` and `src/components/logo.tsx` — the icon; run `pnpm icons`
6. `README.md` — this file; `LICENSE` — the copyright holder, if it isn't you
7. `.github/dependabot.yml` — `assignees`
8. `.rulesync/rules/overview.md` — the project overview handed to AI coding agents
9. `.devcontainer/devcontainer.json` — the `TS_TEMPLATE_DEVCONTAINER_*` prefix

## Deploy to Cloudflare

`wrangler.example.jsonc` shows `wrangler.jsonc` filled in for production (custom domain, sender,
Turnstile, VAPID key, D1 id), with the secrets listed at the top; wrangler does not read it.

1. Create the database and put its id in `wrangler.jsonc` (`database_id`):
   `pnpm exec wrangler d1 create ts-template`, then `pnpm db:migrate:remote`.
2. Onboard the sender domain to Cloudflare Email Service (Dashboard → Email → Email Sending) and set
   `EMAIL_FROM` in `wrangler.jsonc`.
3. Create a Turnstile widget for your hostnames, put its site key in `TURNSTILE_SITE_KEY` and its
   secret in the `TURNSTILE_SECRET_KEY` secret.
4. For push notifications, run `pnpm vapid`: put `VAPID_PUBLIC_KEY` in `wrangler.jsonc`, the private
   key in the `VAPID_PRIVATE_KEY` secret, and a contact in `VAPID_SUBJECT`.
5. Set the secrets with `pnpm exec wrangler secret put <NAME>`:

   | Secret                 | Purpose                                                          |
   | ---------------------- | ---------------------------------------------------------------- |
   | `BETTER_AUTH_SECRET`   | Signs session cookies (`openssl rand -base64 48`). Required.     |
   | `TURNSTILE_SECRET_KEY` | Verifies Turnstile tokens; unset means the test keys.            |
   | `VAPID_PRIVATE_KEY`    | Signs push messages; unset switches push notifications off.      |
   | `ALLOWED_EMAILS`       | Comma-separated addresses allowed to sign in; unset lets anyone. |

6. `pnpm run deploy` (not `pnpm deploy`, which is a pnpm built-in). To deploy from GitHub Actions,
   add the `CLOUDFLARE_API_TOKEN` (the "Edit Cloudflare Workers" template plus Account → D1 → Edit)
   and `CLOUDFLARE_ACCOUNT_ID` repository secrets and run the Deploy workflow, or switch it to run on
   every push (see the comment at the top of `.github/workflows/deploy.yml`).

To serve the app from your own hostname, uncomment `routes` in `wrangler.jsonc`.

## Sending push notifications

```ts
import { notifyUser } from "./lib/push";

// From a server function, route handler or scheduled handler:
await notifyUser({
  userId,
  notification: { title: "Your report is ready", body: "Tap to open it.", url: "/reports/42" },
});
```

The service worker shows the notification and opens `url` (a path on this app) when it is tapped.
Subscription endpoints are accepted only from the known push services (`src/lib/push.ts`), so a
client cannot make the Worker POST to an arbitrary address. The test button on the account page is
capped by the `PUSH_TEST_LIMITER` rate limit binding. When the browser renews a subscription on its own, the service worker
sends the new one to `/api/push/subscription`.

## Scripts

| Script                   | Description                                                                             |
| ------------------------ | --------------------------------------------------------------------------------------- |
| `pnpm dev`               | Vite dev server                                                                         |
| `pnpm dev:cf`            | Build and serve the Worker in the Cloudflare emulator (`--fresh` wipes the local state) |
| `pnpm build`             | Build the client assets and the Worker into `dist`                                      |
| `pnpm run deploy`        | Build and deploy to Cloudflare Workers                                                  |
| `pnpm check`             | `fmt:check` + `oxlint` + `typecheck`                                                    |
| `pnpm cicheck`           | `cicheck:code` + `cicheck:content`                                                      |
| `pnpm cicheck:code`      | `check` + `test`                                                                        |
| `pnpm cicheck:content`   | `cspell` + `secretlint`                                                                 |
| `pnpm test`              | Run the unit tests                                                                      |
| `pnpm e2e`               | Run the browser tests against the built Worker in the emulator                          |
| `pnpm db:generate`       | Generate a migration from `src/db/schema.ts` (`--name <change>`)                        |
| `pnpm db:migrate:local`  | Apply migrations to the local D1                                                        |
| `pnpm db:migrate:remote` | Apply migrations to the deployed D1                                                     |
| `pnpm db:reset:local`    | Wipe the local D1 and migrate again                                                     |
| `pnpm cf-typegen`        | Regenerate `worker-configuration.d.ts` after changing bindings                          |
| `pnpm icons`             | Redraw the PWA icons                                                                    |
| `pnpm vapid`             | Print a new VAPID key pair for push notifications                                       |
| `pnpm fix`               | Auto-fix formatting and lint problems                                                   |
| `pnpm generate`          | Regenerate AI tool configs from `.rulesync/`                                            |
| `pnpm knip`              | Report unused files, exports, and dependencies                                          |

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

## License

[MIT](./LICENSE)
