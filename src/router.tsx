import { createRouter } from "@tanstack/react-router";

import { RouteError, RouteNotFound } from "./components/route-error";
import { loadMessages } from "./i18n/messages";
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
    // The browser hydrates without running `beforeLoad`: load the catalogue
    // of the language the server rendered the page in first, so hydration
    // renders what the server did. A chunk that cannot be fetched (offline,
    // never kept) must not stop the page from hydrating.
    hydrate: async () => {
      if (document.documentElement.lang === "en") {
        await loadMessages("en").catch(() => undefined);
      }
    },
  });
}
