import handler from "@tanstack/react-start/server-entry";

import { CSP_NONCE_HEADER } from "./lib/csp-nonce";
import { createNonce, withSecurityHeaders } from "./lib/security-headers";

/**
 * The Worker's entry: TanStack Start answers requests with the security
 * headers added. Each response gets its own CSP nonce, handed to the router
 * through a request header (src/lib/csp-nonce.ts). `vite dev` injects inline
 * scripts of its own, so it runs without the policy. Add `scheduled` or
 * `queue` handlers here when the app needs them.
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
} satisfies ExportedHandler<Env>;
