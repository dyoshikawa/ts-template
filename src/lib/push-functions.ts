import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { env } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";
import * as z from "zod/mini";

import { createDb } from "../db/client";
import * as schema from "../db/schema";
import { requestLanguage } from "../i18n/language";
import { messagesFor } from "../i18n/messages";
import { createAuth } from "./auth";
import { requireUserId } from "./auth-server";
import { notifyUser, saveSubscription, subscriptionInput, vapidKeys } from "./push";

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
  .validator((input: unknown) => subscriptionInput.parse(input))
  .handler(async ({ data }) => {
    await saveSubscription({ userId: await requireUserId(), subscription: data });
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
  const request = getRequest();
  const session = await createAuth({ request }).api.getSession({ headers: request.headers });
  if (!session) {
    throw new Response("Unauthorized", { status: 401 });
  }
  const userId = session.user.id;
  // In the user's language: the saved choice, else this page's.
  const t = messagesFor(requestLanguage({ request, saved: session.user.language })).notifications;
  const { success } = await env.PUSH_TEST_LIMITER.limit({ key: userId });
  if (!success) {
    return { ok: false as const, reason: "rate-limited" as const };
  }
  const result = await notifyUser({
    userId,
    notification: {
      title: t.test.title,
      body: t.test.body,
      url: "/account",
    },
  });
  return { ok: true as const, ...result };
});
