import { getRequest } from "@tanstack/react-start/server";

import { createAuth } from "./auth";

type SessionResult = Awaited<ReturnType<ReturnType<typeof createAuth>["api"]["getSession"]>>;

const sessions = new WeakMap<Request, Promise<SessionResult>>();

/**
 * The session of the current request, read once per request. While a page
 * renders on the server, the root route and every loader's server function
 * see the same Request, so the page builds Better Auth and looks the session
 * up (two D1 queries once the cookie cache has lapsed) once instead of once
 * per server function. Code that must skip the cookie cache (see
 * `refreshSessionCache`, `deleteAccount`) asks Better Auth directly.
 */
export function readSession(): Promise<SessionResult> {
  const request = getRequest();
  let session = sessions.get(request);
  if (session === undefined) {
    session = createAuth({ request }).api.getSession({ headers: request.headers });
    sessions.set(request, session);
  }
  return session;
}

/**
 * The signed-in user's id for a server function; 401 when there is none. The
 * route-level redirect to the sign-in page only covers navigation, so every
 * server function that touches a user's data checks here too.
 */
export async function requireUserId(): Promise<string> {
  const session = await readSession();
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
