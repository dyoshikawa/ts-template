import { bindings, defineConfig } from "cf/config";

// Config for Cloudflare's `cf` CLI, checked with `pnpm cf:dry-run`. Deploys
// still run on wrangler (`pnpm run deploy`): `cf deploy` 1.0.0-beta.5 drops the
// Worker's secrets. `wrangler.jsonc` is kept alongside it for what still runs
// on wrangler (local dev, the browser tests, D1 migrations, `wrangler types`).
// Change a binding in both files.
// Secrets are set with `wrangler secret put`; they are not declared here
// because `bindings.secret()` makes every one required.
export default defineConfig({
  worker: {
    name: "ts-template",
    compatibilityDate: "2026-09-18",
    compatibilityFlags: ["nodejs_compat"],
    entrypoint: "src/server.ts",
    observability: {
      enabled: true,
    },
    env: {
      EMAIL_FROM: bindings.text("no-reply@example.com"),
      TURNSTILE_SITE_KEY: bindings.text(""),
      VAPID_PUBLIC_KEY: bindings.text(""),
      VAPID_SUBJECT: bindings.text("mailto:admin@example.com"),
      DB: bindings.d1({
        name: "ts-template",
        id: "00000000-0000-0000-0000-000000000000",
      }),
      EMAIL: bindings.sendEmail({}),
      PUSH_TEST_LIMITER: bindings.rateLimit({
        namespace: "1001",
        simple: {
          limit: 3,
          period: 60,
        },
      }),
    },
  },
});
