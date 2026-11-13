import { createFileRoute } from "@tanstack/react-router";

import { authEndpointPaths, isAuthEndpointRequest } from "../../../lib/auth-paths";

/**
 * Better Auth's endpoints, passkeys included. Better Auth and the passkey
 * plugin are loaded here on demand: server routes are part of the route tree
 * every page loads, so a static import would put them on the cold start of
 * every other request (`auth-guard` pulls `better-auth/api`, so it is loaded
 * on demand too). A path that is no endpoint is answered here, before Better
 * Auth's rate limiter would store a row for it (see `isAuthEndpointRequest`).
 */
const handle = async ({ request }: { request: Request }) => {
  const [{ createAuth }, { passkeyPlugins }, { DISABLED_AUTH_PATHS }] = await Promise.all([
    import("../../../lib/auth"),
    import("../../../lib/auth-passkey"),
    import("../../../lib/auth-guard"),
  ]);
  const auth = createAuth({ request, passkeys: passkeyPlugins({ request }) });
  const paths = authEndpointPaths({ endpoints: auth.api, disabled: DISABLED_AUTH_PATHS });
  if (!isAuthEndpointRequest({ url: request.url, paths })) {
    return new Response(null, { status: 404 });
  }
  return auth.handler(request);
};

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: handle,
      POST: handle,
    },
  },
});
