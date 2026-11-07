import { createFileRoute } from "@tanstack/react-router";

import { createAuth } from "../../../lib/auth";
import { DISABLED_AUTH_PATHS } from "../../../lib/auth-guard";
import { authEndpointPaths, isAuthEndpointRequest } from "../../../lib/auth-paths";

/**
 * Better Auth's endpoints, passkeys included. The passkey plugin is loaded
 * here on demand, so it stays off the cold start of every other request.
 * A path that is no endpoint is answered here, before Better Auth's rate
 * limiter would store a row for it (see `isAuthEndpointRequest`).
 */
const handle = async ({ request }: { request: Request }) => {
  const { passkeyPlugins } = await import("../../../lib/auth-passkey");
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
