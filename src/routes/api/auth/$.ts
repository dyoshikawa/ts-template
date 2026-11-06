import { createFileRoute } from "@tanstack/react-router";

/**
 * Better Auth's endpoints, passkeys included. Better Auth and the passkey
 * plugin are loaded here on demand: server routes are part of the route tree
 * every page loads, so a static import would put them on the cold start of
 * every other request.
 */
const handle = async ({ request }: { request: Request }) => {
  const [{ createAuth }, { passkeyPlugins }] = await Promise.all([
    import("../../../lib/auth"),
    import("../../../lib/auth-passkey"),
  ]);
  return createAuth({ request, passkeys: passkeyPlugins({ request }) }).handler(request);
};

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: handle,
      POST: handle,
    },
  },
});
