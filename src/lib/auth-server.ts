import { getRequest } from "@tanstack/react-start/server";

import { hasSessionCookie } from "./session-cookie";

// Better Auth (about 1 MB of the Worker's code) is imported on first use, not
// with this module: a signed-out visitor's page never needs it (see
// `readSession`), so a cold start serving one does not evaluate it.
type CreateAuth = (typeof import("./auth"))["createAuth"];
type SessionResult = Awaited<ReturnType<ReturnType<CreateAuth>["api"]["getSession"]>>;

/** Better Auth's `createAuth`, imported on first use (see above). */
export async function loadCreateAuth(): Promise<CreateAuth> {
  return (await import("./auth")).createAuth;
}

async function lookUpSession(request: Request): Promise<SessionResult> {
  if (!hasSessionCookie(request.headers.get("cookie"))) {
    return null;
  }
  const createAuth = await loadCreateAuth();
  return createAuth({ request }).api.getSession({ headers: request.headers });
}

const sessions = new WeakMap<Request, Promise<SessionResult>>();

/**
 * The session of the current request, read once per request. While a page
 * renders on the server, the root route and every loader's server function
 * see the same Request, so the page builds Better Auth and looks the session
 * up (two D1 queries once the cookie cache has lapsed) once instead of once
 * per server function. Without a session cookie the answer is `null`
 * without loading Better Auth, as Better Auth itself would answer. Code that
 * must skip the cookie cache (see `refreshSessionCache`, `deleteAccount`)
 * asks Better Auth directly.
 */
export function readSession(): Promise<SessionResult> {
  const request = getRequest();
  let session = sessions.get(request);
  if (session === undefined) {
    session = lookUpSession(request);
    sessions.set(request, session);
    // A failed lookup (a D1 hiccup) is not kept: the next caller tries again.
    session.catch(() => sessions.delete(request));
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
  const createAuth = await loadCreateAuth();
  await createAuth({ request }).api.getSession({
    headers: request.headers,
    query: { disableCookieCache: true },
  });
}
