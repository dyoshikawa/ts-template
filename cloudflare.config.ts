import { bindings, defineConfig, triggers } from "cf/config";

// Config for Cloudflare's `cf` CLI, which deploys the Worker (`pnpm run deploy`;
// check it with `pnpm cf:dry-run`). `wrangler.jsonc` stays for what still runs
// on wrangler (local dev, the browser tests, D1 migrations from `drizzle/`,
// `wrangler types`), so change a binding in both files.
// `@cloudflare/vite-plugin` is held at 1.64.0: 1.65.0 dropped the support for
// this file and the Build Output `cf deploy` reads (upstream moved it to the v2
// plugin, still in beta).
// Secrets are set with `wrangler secret put`; they are not declared here
// because `bindings.secret()` makes every one required. A deploy keeps the
// undeclared ones (cf 1.0.0-beta.27).
export default defineConfig({
  worker: {
    name: "ts-template",
    compatibilityDate: "2026-09-18",
    compatibilityFlags: ["nodejs_compat"],
    entrypoint: "src/server.ts",
    // Your own hostname (a Custom Domain), mirroring `routes` in wrangler.jsonc.
    // workersDev: true,
    // domains: ["app.example.com"],
    observability: {
      enabled: true,
    },
    triggers: [
      triggers.scheduled({
        schedule: "30 3 * * *",
      }),
    ],
    env: {
      EMAIL_FROM: bindings.text("no-reply@example.com"),
      TURNSTILE_SITE_KEY: bindings.text(""),
      VAPID_PUBLIC_KEY: bindings.text(""),
      VAPID_SUBJECT: bindings.text("mailto:admin@example.com"),
      PASSKEY_RP_ID: bindings.text(""),
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
