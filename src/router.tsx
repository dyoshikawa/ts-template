import { createRouter } from "@tanstack/react-router";

import { getCspNonce } from "./lib/csp-nonce";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  return createRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: "intent",
    // Every script and preload the router renders carries this response's
    // nonce, which the Content-Security-Policy requires (src/lib/security-headers.ts).
    ssr: { nonce: getCspNonce() },
  });
}
