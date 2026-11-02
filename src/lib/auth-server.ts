import { getRequest } from "@tanstack/react-start/server";

import { createAuth } from "./auth";

/**
 * The signed-in user's id for a server function; 401 when there is none. The
 * route-level redirect to the sign-in page only covers navigation, so every
 * server function that touches a user's data checks here too.
 */
export async function requireUserId(): Promise<string> {
  const request = getRequest();
  const session = await createAuth({ request }).api.getSession({ headers: request.headers });
  if (!session) {
    throw new Response("Unauthorized", { status: 401 });
  }
  return session.user.id;
}

/**
 * Re-reads the session from the database, which also rewrites the session
 * cookie's 5-minute cache: after changing the user row, the next page sees
 * the change at once rather than when the cache runs out.
 */
export async function refreshSessionCache(): Promise<void> {
  const request = getRequest();
  await createAuth({ request }).api.getSession({
    headers: request.headers,
    query: { disableCookieCache: true },
  });
}
