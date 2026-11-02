import handler from "@tanstack/react-start/server-entry";
import { env } from "cloudflare:workers";

import { CSP_NONCE_HEADER } from "./lib/csp-nonce";
import { createNonce, withSecurityHeaders } from "./lib/security-headers";
import { deleteExpiredVerifications } from "./lib/verification-cleanup";

/**
 * The Worker's entry: TanStack Start answers requests with the security
 * headers added. Each response gets its own CSP nonce, handed to the router
 * through a request header (src/lib/csp-nonce.ts). `vp dev` injects inline
 * scripts of its own, so it runs without the policy. The Cron Trigger
 * (`triggers.crons` in `wrangler.jsonc`, nightly) clears expired sign-in
 * codes and passkey challenges; add more scheduled work or a `queue` handler
 * here when the app needs them.
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
      deleteExpiredVerifications({
        d1: env.DB,
        now: new Date(controller.scheduledTime),
      }).then((result) => {
        // oxlint-disable-next-line no-console
        console.info("[cron] expired verifications deleted", JSON.stringify(result));
      }),
    );
  },
} satisfies ExportedHandler<Env>;
