import { createFileRoute } from "@tanstack/react-router";

import { createAuth } from "../../../lib/auth";

/**
 * Better Auth's endpoints, passkeys included. The passkey plugin is loaded
 * here on demand, so it stays off the cold start of every other request.
 */
const handle = async ({ request }: { request: Request }) => {
  const { passkeyPlugins } = await import("../../../lib/auth-passkey");
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
