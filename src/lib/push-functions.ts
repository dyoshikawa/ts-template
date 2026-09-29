import { createServerFn } from "@tanstack/react-start";
import { env } from "cloudflare:workers";
import { and, desc, eq, notInArray } from "drizzle-orm";
import * as z from "zod/mini";

import { createDb } from "../db/client";
import * as schema from "../db/schema";
import { requireUserId } from "./auth-server";
import { isPushServiceEndpoint, notifyUser, vapidKeys } from "./push";

/** Devices a user may have subscribed at once; the oldest beyond this are dropped. */
const MAX_SUBSCRIPTIONS_PER_USER = 10;

const base64Url = z.string().check(z.minLength(1), z.maxLength(256), z.regex(/^[\w-]+$/u));
const endpoint = z
  .string()
  .check(z.maxLength(2048), z.refine(isPushServiceEndpoint, "Not a known push service endpoint"));

/** The public VAPID key browsers subscribe with; empty while push is not configured. */
export const getPushConfig = createServerFn({ method: "GET" }).handler(async () => {
  return { vapidPublicKey: vapidKeys()?.publicKey ?? "" };
});

/**
 * Stores this device's subscription for the signed-in user. Saving the same
 * endpoint again (every visit re-saves it, which also follows a browser that
 * rotated its keys) updates the row, and moves it to the signed-in user.
 */
export const savePushSubscription = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({ endpoint, p256dh: base64Url, auth: base64Url }).parse(input),
  )
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    const db = createDb({ d1: env.DB });
    await db
      .insert(schema.pushSubscription)
      .values({ id: crypto.randomUUID(), userId, ...data })
      .onConflictDoUpdate({
        target: schema.pushSubscription.endpoint,
        set: { userId, p256dh: data.p256dh, auth: data.auth },
      });

    const kept = db
      .select({ id: schema.pushSubscription.id })
      .from(schema.pushSubscription)
      .where(eq(schema.pushSubscription.userId, userId))
      .orderBy(desc(schema.pushSubscription.createdAt))
      .limit(MAX_SUBSCRIPTIONS_PER_USER);
    await db
      .delete(schema.pushSubscription)
      .where(
        and(
          eq(schema.pushSubscription.userId, userId),
          notInArray(schema.pushSubscription.id, kept),
        ),
      );
  });

/** Forgets this device's subscription (turning notifications off, signing out). */
export const deletePushSubscription = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({ endpoint: z.string().check(z.maxLength(2048)) }).parse(input),
  )
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    const db = createDb({ d1: env.DB });
    await db
      .delete(schema.pushSubscription)
      .where(
        and(
          eq(schema.pushSubscription.userId, userId),
          eq(schema.pushSubscription.endpoint, data.endpoint),
        ),
      );
  });

/**
 * Sends a test notification to every device of the signed-in user. The
 * `PUSH_TEST_LIMITER` binding caps how often one user may ask.
 */
export const sendTestNotification = createServerFn({ method: "POST" }).handler(async () => {
  const userId = await requireUserId();
  const { success } = await env.PUSH_TEST_LIMITER.limit({ key: userId });
  if (!success) {
    return { ok: false as const, reason: "rate-limited" as const };
  }
  const result = await notifyUser({
    userId,
    notification: {
      title: "Test notification",
      body: "Push notifications are working on this device.",
      url: "/account",
    },
  });
  return { ok: true as const, ...result };
});
