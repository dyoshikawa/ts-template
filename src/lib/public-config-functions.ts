import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import { passkeyConfig } from "./passkey";
import { turnstileClientConfig } from "./turnstile";

// The sign-in page's loader calls these on every visit. All the handlers of
// one server-function file share one chunk, so they live apart from the
// account's functions: those import Drizzle and the schema, which a
// signed-out page would otherwise load on a cold start.

/** What the Turnstile widgets render from (never the secret); public, so no session is needed. */
export const getTurnstileConfig = createServerFn({ method: "GET" }).handler(async () => {
  return { turnstile: turnstileClientConfig({ request: getRequest() }) };
});

/**
 * Whether this host offers passkeys (see `passkeyConfig`); the pages hide
 * every passkey control when it does not. Public, so no session is needed.
 */
export const getPasskeyAvailability = createServerFn({ method: "GET" }).handler(async () => {
  return { passkeys: passkeyConfig({ request: getRequest() }).status === "enabled" };
});
