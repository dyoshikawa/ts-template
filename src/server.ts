import handler from "@tanstack/react-start/server-entry";
import { env } from "cloudflare:workers";

import { CSP_NONCE_HEADER } from "./lib/csp-nonce";
import { createNonce, withSecurityHeaders } from "./lib/security-headers";

/**
 * The Worker's entry: TanStack Start answers requests with the security
 * headers added. Each response gets its own CSP nonce, handed to the router
 * through a request header (src/lib/csp-nonce.ts). `vp dev` injects inline
 * scripts of its own, so it runs without the policy. The Cron Trigger
 * (`triggers` in `cloudflare.config.ts`, nightly) clears expired sign-in
 * codes and passkey challenges; add more scheduled work or a `queue` handler
 * here when the app needs them. Their code is imported inside the handler:
 * this module is evaluated on every cold start, and a static import would
 * load Drizzle and the schema for requests that never touch the database.
 */
export default {
  fetch: async (request: Request) => {
    if (import.meta.env.DEV) {
      return withSecurityHeaders(await handler.fetch(request));
    }
    const nonce = createNonce();
    const headers = new Headers(request.headers);
    headers.set(CSP_NONCE_HEADER, nonce);
    return withSecurityHeaders(await handler.fetch(new Request(request, { headers })), { nonce });
  },
  scheduled: async (controller, _env, ctx) => {
    ctx.waitUntil(
      import("./lib/verification-cleanup")
        .then(({ deleteExpiredVerifications }) =>
          deleteExpiredVerifications({
            d1: env.DB,
            now: new Date(controller.scheduledTime),
          }),
        )
        .then((result) => {
          // oxlint-disable-next-line no-console
          console.info("[cron] expired verifications deleted", JSON.stringify(result));
        }),
    );
  },
} satisfies ExportedHandler<Env>;
