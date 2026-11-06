import { createRouter } from "@tanstack/react-router";

import { RouteError, RouteNotFound } from "./components/route-error";
import { getCspNonce } from "./lib/csp-nonce";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  return createRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: "intent",
    // The library's own pages are bare English ("Something went wrong!",
    // "Not Found"); these say what kind of failure it was, in the page's language.
    defaultErrorComponent: RouteError,
    defaultNotFoundComponent: RouteNotFound,
    // Every script and preload the router renders carries this response's
    // nonce, which the Content-Security-Policy requires (src/lib/security-headers.ts).
    ssr: { nonce: getCspNonce() },
  });
}
