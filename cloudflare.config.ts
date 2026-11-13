import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseEnv } from "node:util";

import { bindings, defineConfig, triggers } from "cf/config";

// The Worker's configuration, read by Cloudflare's `cf` CLI (`pnpm run
// deploy`, check it with `pnpm cf:dry-run`; D1 migrations, `cf workers
// types`) and by the Cloudflare Vite plugin (`pnpm dev`, the emulator of
// `scripts/cf-dev.mjs`, the browser tests). There is no wrangler.
//
// The values below run locally as they are. For a production deployment,
// replace the ones marked "Production:" (README → "Deploy to Cloudflare"
// says where each value comes from).
//
// Secrets never go in this file. Set them on the Worker with
// `pnpm exec cf workers secrets update <NAME> --worker <name> --type secret_text --text "<value>"`:
//   BETTER_AUTH_SECRET    required, 32+ characters — `openssl rand -base64 48`
//   TURNSTILE_SECRET_KEY  the secret of the widget in TURNSTILE_SITE_KEY
//   VAPID_PRIVATE_KEY     the private half of `pnpm vapid`
//   ALLOWED_EMAILS        optional — comma-separated addresses allowed to sign in
// They are not declared with `bindings.secret()` because that makes every one
// required; a deploy keeps the undeclared ones (cf 1.0.0-beta.27). Their
// types are in `src/env.d.ts`.

/** The modes that build or run the deployed Worker: no local variables there. */
const DEPLOYED_MODES = new Set([undefined, "production"]);

/**
 * A local run's variables (secrets and switches such as `TURNSTILE_DISABLED`)
 * as text bindings: the Vite plugin hands `.dev.vars` values only to declared
 * secrets, and these must never be declared for the deployed Worker. Read
 * from `$CF_DEV_ENV_DIR/.dev.vars` (`scripts/cf-dev.mjs`) or the project's
 * `.dev.vars`; typed as nothing so the generated `Env` stays exact (the
 * optional ones are declared in `src/env.d.ts`).
 */
function localVars(mode: string | undefined): {} {
  if (DEPLOYED_MODES.has(mode)) {
    return {};
  }
  let text: string;
  try {
    text = readFileSync(join(process.env.CF_DEV_ENV_DIR ?? ".", ".dev.vars"), "utf8");
  } catch {
    return {};
  }
  return Object.fromEntries(
    Object.entries(parseEnv(text)).map(([name, value]) => [name, bindings.text(value ?? "")]),
  );
}

export default defineConfig(({ mode }) => ({
  worker: {
    // Production: your app's name (the Worker's name on the account).
    name: "ts-template",
    compatibilityDate: "2026-09-18",
    compatibilityFlags: ["nodejs_compat"],
    // Wraps TanStack Start's handler to add the security headers.
    entrypoint: "src/server.ts",
    // Production: to serve the app from your own hostname (a Custom Domain:
    // the deploy creates the DNS record and the certificate; the zone must be
    // on the same Cloudflare account), uncomment both. Keep `workersDev` true
    // to keep the workers.dev address as well, or set it false to serve the
    // app from the custom domain only.
    // workersDev: true,
    // domains: ["app.example.com"],
    observability: {
      enabled: true,
    },
    // Nightly at 03:30 UTC: deletes expired sign-in codes and passkey
    // challenges (`scheduled` in src/server.ts).
    triggers: [
      triggers.scheduled({
        schedule: "30 3 * * *",
      }),
    ],
    // The vars are typed `string` (`text<string>`), not as the literal value
    // here, so the code does not depend on what a deployment fills in.
    env: {
      // Sender of the sign-in code emails. Production: an address on a domain
      // onboarded to Cloudflare Email Service (Dashboard → Email → Email
      // Sending), e.g. "no-reply@app.example.com".
      EMAIL_FROM: bindings.text<string>("no-reply@example.com"),
      // Public site key of the Cloudflare Turnstile widget that guards the
      // sign-in mailer and account deletion (Dashboard → Turnstile). Pair it
      // with the TURNSTILE_SECRET_KEY secret. Left empty, local runs use
      // Cloudflare's always-passing test keys; the deployed Worker refuses
      // sign-in and account deletion until a real pair is set. Production:
      // the widget's site key; add the custom domain, the workers.dev
      // hostname and `localhost` to the widget's hostnames.
      TURNSTILE_SITE_KEY: bindings.text<string>(""),
      // Public half of the VAPID key pair push notifications are signed with
      // (`pnpm vapid` prints a pair). Pair it with the VAPID_PRIVATE_KEY
      // secret. Leave it empty to switch push notifications off. Changing it
      // later makes every device subscribe again.
      VAPID_PUBLIC_KEY: bindings.text<string>(""),
      // Who push services contact about this sender: a `mailto:` or `https:` URL.
      VAPID_SUBJECT: bindings.text<string>("mailto:admin@example.com"),
      // The one hostname that offers passkeys: your custom domain (`domains`
      // above), without scheme or port, e.g. "app.example.com". A passkey is
      // bound to one domain, so the workers.dev address and any other host
      // sign in by email alone. Leave it empty to switch passkeys off on the
      // deployed Worker; local runs on localhost:4173 / :5173 always offer them.
      PASSKEY_RP_ID: bindings.text<string>(""),
      DB: bindings.d1({
        // Production: your app's name.
        name: "ts-template",
        // Production: the id `pnpm exec cf d1 create --name <name>` prints
        // (`scripts/d1-migrate.mjs` reads it from here too). Local runs
        // (`pnpm dev`, `pnpm dev:cf`, `pnpm e2e`) work with this placeholder,
        // which is shaped like a real id because `cf` accepts nothing else.
        id: "00000000-0000-4000-8000-000000000000",
      }),
      EMAIL: bindings.sendEmail({}),
      // Caps how often one user may send themselves a test notification
      // (src/lib/push-functions.ts). The period is 10 or 60 seconds; the
      // namespace is any number unique among the account's rate limit
      // namespaces.
      PUSH_TEST_LIMITER: bindings.rateLimit({
        namespace: "1001",
        simple: {
          limit: 3,
          period: 60,
        },
      }),
      ...localVars(mode),
    },
  },
}));
