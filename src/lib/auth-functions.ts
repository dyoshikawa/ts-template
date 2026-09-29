import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import { createAuth } from "./auth";

/**
 * The signed-in user for the current request, or `null`. Only what the
 * pages show is returned — never the session row, whose token would
 * otherwise be serialized into the HTML.
 */
export const getSession = createServerFn({ method: "GET" }).handler(async () => {
  const request = getRequest();
  const session = await createAuth({ request }).api.getSession({ headers: request.headers });
  if (!session) {
    return null;
  }
  const { id, email, name } = session.user;
  return { user: { id, email, name } };
});

export type SessionData = Awaited<ReturnType<typeof getSession>>;
