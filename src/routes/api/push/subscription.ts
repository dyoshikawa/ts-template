import { createFileRoute } from "@tanstack/react-router";

import { createAuth } from "../../../lib/auth";
import { saveSubscription, subscriptionInput } from "../../../lib/push";

/**
 * Where the service worker sends a subscription the browser renewed on its
 * own (`pushsubscriptionchange` in public/sw.js), with the page's session
 * cookie. The page itself saves through `savePushSubscription`.
 *
 * Only a same-origin JSON request is accepted: a cross-site form could
 * otherwise attach an attacker's endpoint to a signed-in user's account.
 */
export const Route = createFileRoute("/api/push/subscription")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const origin = request.headers.get("Origin");
        if (origin !== null && origin !== new URL(request.url).origin) {
          return new Response("Forbidden", { status: 403 });
        }
        if (!(request.headers.get("Content-Type") ?? "").startsWith("application/json")) {
          return new Response("Unsupported Media Type", { status: 415 });
        }
        const session = await createAuth({ request }).api.getSession({ headers: request.headers });
        if (!session) {
          return new Response("Unauthorized", { status: 401 });
        }
        const parsed = subscriptionInput.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return new Response("Bad Request", { status: 400 });
        }
        await saveSubscription({ userId: session.user.id, subscription: parsed.data });
        return new Response(null, { status: 204 });
      },
    },
  },
});
