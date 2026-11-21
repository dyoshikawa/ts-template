import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { env } from "cloudflare:workers";
import { asc, eq, inArray } from "drizzle-orm";
import * as z from "zod/mini";

import { createDb } from "../db/client";
import * as schema from "../db/schema";
import { loadCreateAuth, requireSession } from "./auth-server";
import { otpIdentifiers } from "./otp-identifiers";
import { passkeyConfig } from "./passkey";
import { logTurnstileUnconfigured, turnstileConfig, verifyTurnstile } from "./turnstile";

// The account page's server functions. They share one chunk with Drizzle and
// the schema, so anything a signed-out page calls goes in
// `public-config-functions.ts` instead.

/**
 * How old a session may be to add a passkey: Better Auth's `freshAge`
 * default (a day from the sign-in), which its passkey plugin enforces.
 */
const PASSKEY_FRESH_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * The signed-in user's passkeys, oldest first, as the account page lists
 * them, and whether this session is fresh enough to add one (sessions last
 * 90 days, adding a passkey needs a sign-in within the last day); `null` on a
 * host that offers no passkeys (see `passkeyConfig`).
 */
export const listPasskeys = createServerFn({ method: "GET" }).handler(async () => {
  const request = getRequest();
  const session = await requireSession();
  if (passkeyConfig({ request }).status !== "enabled") {
    return null;
  }
  const passkeys = await createDb({ d1: env.DB })
    .select({
      id: schema.passkey.id,
      name: schema.passkey.name,
      createdAt: schema.passkey.createdAt,
    })
    .from(schema.passkey)
    .where(eq(schema.passkey.userId, session.user.id))
    .orderBy(asc(schema.passkey.createdAt));
  const canAdd = Date.now() - new Date(session.session.createdAt).getTime() < PASSKEY_FRESH_AGE_MS;
  return { passkeys, canAdd };
});

/**
 * Closes the signed-in account for good: the push subscriptions, the passkeys, the sessions,
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
    // Loaded here, so the account page's other server functions in this
    // file do not load Better Auth before they need it (see `readSession`).
    const auth = (await loadCreateAuth())({ request });
    // Read from the database, not the 5-minute cookie cache: a session signed
    // out or revoked elsewhere must not delete the account.
    const session = await auth.api.getSession({
      headers: request.headers,
      query: { disableCookieCache: true },
    });
    if (!session) {
      throw new Response("Unauthorized", { status: 401 });
    }
    if (turnstileConfig({ request }).status === "unconfigured") {
      logTurnstileUnconfigured();
      throw new Response("Account deletion is not available: Turnstile is not set up", {
        status: 503,
      });
    }
    const verified = await verifyTurnstile({
      request,
      token: data.turnstileToken,
      remoteIp: request.headers.get("CF-Connecting-IP"),
      action: "delete-account",
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
      db.delete(schema.passkey).where(eq(schema.passkey.userId, userId)),
      db
        .delete(schema.verification)
        .where(inArray(schema.verification.identifier, otpIdentifiers(session.user.email))),
      db.delete(schema.user).where(eq(schema.user.id, userId)),
    ]);
  });
