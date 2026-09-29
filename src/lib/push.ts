import { env } from "cloudflare:workers";
import { and, desc, eq, inArray, notInArray } from "drizzle-orm";
import * as z from "zod/mini";

import { createDb } from "../db/client";
import * as schema from "../db/schema";
import { type PushSubscriptionKeys, type VapidKeys, sendWebPush } from "./web-push";

/** What a notification shows, and the page a tap on it opens (a path on this app). */
export type Notification = { title: string; body: string; url?: string };

/**
 * The push services browsers subscribe with. Subscribing hands the server a
 * URL it will later POST to, so only these hosts are accepted — anything else
 * would let a client point the Worker at an arbitrary address.
 */
const PUSH_SERVICE_HOSTS = [
  // Chrome, Edge, Samsung Internet and other Chromium browsers.
  /^fcm\.googleapis\.com$/u,
  // Firefox.
  /^[\w-]+\.push\.services\.mozilla\.com$/u,
  // Safari (macOS and iOS/iPadOS 16.4+ home-screen apps).
  /^[\w-]+\.push\.apple\.com$/u,
  // Edge on Windows (WNS).
  /^[\w-]+\.notify\.windows\.com$/u,
];

/** Whether `endpoint` is an https URL on a known push service. */
export function isPushServiceEndpoint(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  return (
    url.protocol === "https:" &&
    url.port === "" &&
    PUSH_SERVICE_HOSTS.some((host) => host.test(url.hostname))
  );
}

/** Devices a user may have subscribed at once; the oldest beyond this are dropped. */
const MAX_SUBSCRIPTIONS_PER_USER = 10;

const base64Url = z.string().check(z.minLength(1), z.maxLength(256), z.regex(/^[\w-]+$/u));

/** A subscription as the browser hands it over, checked before it is stored. */
export const subscriptionInput = z.object({
  endpoint: z
    .string()
    .check(z.maxLength(2048), z.refine(isPushServiceEndpoint, "Not a known push service endpoint")),
  p256dh: base64Url,
  auth: base64Url,
});

/**
 * Stores a subscription for `userId`: the same endpoint again updates the row
 * (and moves it to this user), and the user's oldest beyond
 * `MAX_SUBSCRIPTIONS_PER_USER` are dropped.
 */
export async function saveSubscription({
  userId,
  subscription,
}: {
  userId: string;
  subscription: PushSubscriptionKeys;
}): Promise<void> {
  const db = createDb({ d1: env.DB });
  await db
    .insert(schema.pushSubscription)
    .values({ id: crypto.randomUUID(), userId, ...subscription })
    .onConflictDoUpdate({
      target: schema.pushSubscription.endpoint,
      set: { userId, p256dh: subscription.p256dh, auth: subscription.auth },
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
      and(eq(schema.pushSubscription.userId, userId), notInArray(schema.pushSubscription.id, kept)),
    );
}

/** The VAPID identity, or `null` while push notifications are not configured. */
export function vapidKeys(): VapidKeys | null {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT) {
    return null;
  }
  return {
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
    subject: env.VAPID_SUBJECT,
  };
}

/**
 * Sends `notification` to every device the user subscribed. Subscriptions the
 * push service reports gone (404, 410) are deleted. Returns how many devices
 * accepted it and how many did not.
 */
export async function notifyUser({
  userId,
  notification,
}: {
  userId: string;
  notification: Notification;
}): Promise<{ sent: number; failed: number }> {
  const vapid = vapidKeys();
  if (!vapid) {
    return { sent: 0, failed: 0 };
  }
  const db = createDb({ d1: env.DB });
  const subscriptions = await db
    .select()
    .from(schema.pushSubscription)
    .where(eq(schema.pushSubscription.userId, userId));
  const payload = JSON.stringify({ url: "/", ...notification });

  const results = await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        return { id: subscription.id, status: await sendWebPush({ subscription, payload, vapid }) };
      } catch {
        return { id: subscription.id, status: 0 };
      }
    }),
  );
  const gone = results.filter(({ status }) => status === 404 || status === 410);
  if (gone.length > 0) {
    await db.delete(schema.pushSubscription).where(
      inArray(
        schema.pushSubscription.id,
        gone.map(({ id }) => id),
      ),
    );
  }
  const sent = results.filter(({ status }) => status >= 200 && status < 300).length;
  return { sent, failed: results.length - sent };
}
