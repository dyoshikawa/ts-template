import { defineConfig, devices } from "@playwright/test";

/** Where the emulator serves the built Worker for the tests; `E2E_PORT` moves it off a busy port. */
const PORT = Number(process.env.E2E_PORT ?? 4173);
const BASE_URL = `http://localhost:${PORT}`;

/**
 * Browser tests against the production bundle in the Cloudflare emulator
 * (`scripts/cf-dev.mjs`): local D1 and Email Service, Turnstile switched
 * off and a fixed sign-in code (`.dev.vars.e2e`), on a fresh database each run.
 */
export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // A stuck run ends here, with a report and traces, rather than at the job's
  // fifteen-minute timeout, which cancels the step and leaves nothing behind.
  globalTimeout: process.env.CI ? 13 * 60_000 : 0,
  reporter: process.env.CI ? [["list"], ["github"]] : "list",
  use: {
    baseURL: BASE_URL,
    ...devices["iPhone 13"],
    // The mobile emulation switches to WebKit; keep Chromium.
    defaultBrowserType: "chromium",
    // The service worker would otherwise serve stale assets across builds.
    serviceWorkers: "block",
    trace: "retain-on-failure",
  },
  webServer: {
    command: `node scripts/cf-dev.mjs --vars .dev.vars.e2e --state .wrangler/state-e2e --fresh --port ${PORT}`,
    url: `${BASE_URL}/login`,
    reuseExistingServer: false,
    timeout: 180_000,
    // SIGTERM first, so wrangler stops workerd itself: on the CI runner the
    // default kill left the run waiting on the emulator after the last test
    // until the global timeout.
    gracefulShutdown: { signal: "SIGTERM", timeout: 10_000 },
  },
});
