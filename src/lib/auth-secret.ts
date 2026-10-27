import { env } from "cloudflare:workers";

import { isLocalRequest } from "./local-request";

/**
 * Stand-in secret for local runs only (`vite dev`, the emulator without a
 * `.dev.vars` secret), where there is no `wrangler secret`.
 */
const DEV_SECRET = "insecure-dev-only-secret-do-not-use-in-production";

/**
 * Better Auth warns below this length; a deployed Worker refuses a shorter
 * secret outright, since it is all that stands between a forged session
 * cookie and somebody else's account.
 */
const MIN_SECRET_LENGTH = 32;

/**
 * What Better Auth signs with when it is given no secret. It is published in
 * the package and long enough to pass the length check, so a deployed Worker
 * refuses it by name.
 */
const BETTER_AUTH_DEFAULT_SECRET = "better-auth-secret-12345678901234567890";

/**
 * The secret session cookies are signed with, for one request.
 *
 * Left without one, Better Auth signs with a default secret published in its
 * own package, and only refuses that when `NODE_ENV` is `production` — which
 * is never set in a Worker. Anybody could then forge a session cookie for any
 * user. So the deployed Worker fails closed instead: without a configured
 * secret of at least {@link MIN_SECRET_LENGTH} characters (or with that very
 * default) this throws, and since the root route reads the session on every page load, every page
 * answers with a server error until the secret is set. Local runs (`vite dev`,
 * requests to a local address) fall back to a fixed development secret.
 */
export function resolveAuthSecret({ request }: { request: Request }): string {
  // Used as given (an existing secret keeps verifying the cookies it signed);
  // one of nothing but whitespace counts as unset.
  const secret = env.BETTER_AUTH_SECRET?.trim() ? env.BETTER_AUTH_SECRET : undefined;
  if (import.meta.env.DEV || isLocalRequest(request)) {
    return secret || DEV_SECRET;
  }
  if (
    !secret ||
    secret.trim().length < MIN_SECRET_LENGTH ||
    secret.trim() === BETTER_AUTH_DEFAULT_SECRET
  ) {
    // oxlint-disable-next-line no-console
    console.error(
      `[auth] BETTER_AUTH_SECRET is not set, shorter than ${MIN_SECRET_LENGTH} characters or Better Auth's public default; refusing the request`,
    );
    throw new Error("BETTER_AUTH_SECRET is not configured");
  }
  return secret;
}
