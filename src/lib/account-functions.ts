import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { env } from "cloudflare:workers";
import { eq, like } from "drizzle-orm";
import * as z from "zod/mini";

import { createDb } from "../db/client";
import * as schema from "../db/schema";
import { createAuth } from "./auth";
import { turnstileSiteKey, verifyTurnstile } from "./turnstile";

/** The site key the Turnstile widgets render with; public, so no session is needed. */
export const getTurnstileSiteKey = createServerFn({ method: "GET" }).handler(async () => {
  return { turnstileSiteKey: turnstileSiteKey({ request: getRequest() }) };
});

/**
 * Closes the signed-in account for good: the push subscriptions, the sessions,
 * the sign-in codes and the user row itself are deleted in one batch, after the Turnstile token
 * proves a person pressed the button. Nothing is kept. Tables that hold a
 * user's data belong in the batch too, children first.
 */
export const deleteAccount = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({ turnstileToken: z.string().check(z.minLength(1), z.maxLength(4096)) }).parse(input),
  )
  .handler(async ({ data }) => {
    const request = getRequest();
    const auth = createAuth({ request });
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
      throw new Response("Unauthorized", { status: 401 });
    }
    const verified = await verifyTurnstile({
      request,
      token: data.turnstileToken,
      remoteIp: request.headers.get("CF-Connecting-IP"),
    });
    if (!verified) {
      throw new Response("Turnstile verification failed", { status: 400 });
    }

    const userId = session.user.id;
    const db = createDb({ d1: env.DB });

    // Clears the session cookies while the session row still exists.
    await auth.api.signOut({ headers: request.headers });

    await db.batch([
      db.delete(schema.pushSubscription).where(eq(schema.pushSubscription.userId, userId)),
      db.delete(schema.session).where(eq(schema.session.userId, userId)),
      db.delete(schema.account).where(eq(schema.account.userId, userId)),
      db
        .delete(schema.verification)
        .where(like(schema.verification.identifier, `%-otp-${session.user.email}`)),
      db.delete(schema.user).where(eq(schema.user.id, userId)),
    ]);
  });
