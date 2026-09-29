import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

/**
 * The request header src/server.ts passes this response's CSP nonce in. The
 * Worker entry always overwrites it, so a client cannot choose the nonce.
 */
export const CSP_NONCE_HEADER = "x-csp-nonce";

/**
 * This response's CSP nonce, for the router's `ssr.nonce`: on the server the
 * one src/server.ts put on the request, in the browser the one the page was
 * rendered with (TanStack Router writes it to `<meta property="csp-nonce">`).
 * `undefined` where there is none (`vite dev`).
 */
export const getCspNonce = createIsomorphicFn()
  .server(() => getRequest().headers.get(CSP_NONCE_HEADER) ?? undefined)
  .client(
    () =>
      document.querySelector<HTMLMetaElement>('meta[property="csp-nonce"]')?.content || undefined,
  );
