// Secrets are set with `wrangler secret put`, so `wrangler types` cannot see
// them; declare them here on top of the generated `Env`.
declare namespace Cloudflare {
  interface Env {
    /**
     * Signs session cookies; at least 32 characters (`openssl rand -base64 48`).
     * Required on the deployed Worker, which refuses every auth request
     * without it; local runs fall back to a fixed development secret.
     */
    BETTER_AUTH_SECRET?: string;
    /**
     * Comma-separated addresses allowed to sign in; unset lets anybody in.
     * Set on the deployed Worker to keep the app to its owner.
     */
    ALLOWED_EMAILS?: string;
    /**
     * Private half of the VAPID key pair (`pnpm vapid`) push notifications are
     * signed with; unset switches push notifications off.
     */
    VAPID_PRIVATE_KEY?: string;
    /**
     * Turnstile secret matching `TURNSTILE_SITE_KEY`. Unset, local runs use
     * the test keys and a deployed Worker refuses every token.
     */
    TURNSTILE_SECRET_KEY?: string;
    /**
     * `1` switches Turnstile off: no widget, every token verifies. Local runs
     * and browser tests only — never set it on the deployed Worker.
     */
    TURNSTILE_DISABLED?: string;
    /**
     * A fixed sign-in code for browser tests instead of a random one. Local
     * runs only — never set it on the deployed Worker.
     */
    E2E_SIGN_IN_CODE?: string;
  }
}
