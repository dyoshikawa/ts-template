/**
 * Push notifications on this device: whether they can work here, and turning
 * them on and off. Browser-only; the server side is src/lib/push-functions.ts.
 */
import { deletePushSubscription, savePushSubscription } from "./push-functions";

/**
 * What stands between this device and notifications:
 * - `unsupported`: the browser has no Push API;
 * - `install-first`: iOS/iPadOS, where only an app added to the home screen
 *   (16.4+) may receive pushes;
 * - `no-worker`: no service worker is registered — `pnpm dev` never registers
 *   one; use the built app (`pnpm dev:cf`) or a deployment;
 * - `ready`: notifications can be turned on.
 */
export type PushSupport = "unsupported" | "install-first" | "no-worker" | "ready";

const isIos = (): boolean =>
  /iPad|iPhone|iPod/u.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

const runsInstalled = (): boolean =>
  window.matchMedia("(display-mode: standalone), (display-mode: fullscreen)").matches ||
  (navigator as { standalone?: boolean }).standalone === true;

export async function pushSupport(): Promise<PushSupport> {
  const hasApi =
    "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (!hasApi) {
    return isIos() && !runsInstalled() ? "install-first" : "unsupported";
  }
  const registration = await navigator.serviceWorker.getRegistration();
  return registration ? "ready" : "no-worker";
}

/** This device's subscription, if notifications are on. */
async function currentSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.getRegistration();
  return (await registration?.pushManager.getSubscription()) ?? null;
}

function toKeys(subscription: PushSubscription) {
  const { endpoint, keys } = subscription.toJSON();
  if (!endpoint || !keys?.p256dh || !keys.auth) {
    throw new Error("The browser returned an incomplete push subscription");
  }
  return { endpoint, p256dh: keys.p256dh, auth: keys.auth };
}

/** Sends this device's subscription to the server again, in case the browser rotated it. */
export async function resyncSubscription(): Promise<boolean> {
  const subscription = await currentSubscription();
  if (!subscription) {
    return false;
  }
  await savePushSubscription({ data: toKeys(subscription) });
  return true;
}

/**
 * Asks for permission and subscribes this device. Must run inside a tap
 * handler: browsers refuse (or silently deny) a permission prompt otherwise.
 */
export async function enableNotifications(vapidPublicKey: string): Promise<"enabled" | "denied"> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return "denied";
  }
  const registration = await navigator.serviceWorker.ready;
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: vapidPublicKey,
    }));
  await savePushSubscription({ data: toKeys(subscription) });
  return "enabled";
}

/**
 * Unsubscribes this device and tells the server to forget it. Called on
 * signing out too, so the next person signed in here does not get the
 * previous one's notifications. `forgetOnServer: false` skips the server
 * call (the account is gone already).
 */
export async function disableNotifications({ forgetOnServer = true } = {}): Promise<void> {
  if (!("serviceWorker" in navigator)) {
    return;
  }
  const subscription = await currentSubscription();
  if (!subscription) {
    return;
  }
  if (forgetOnServer) {
    await deletePushSubscription({ data: { endpoint: subscription.endpoint } }).catch(() => {
      // Offline or signed out already: the push service will report the
      // endpoint gone once it is unsubscribed below, and the row is dropped then.
    });
  }
  await subscription.unsubscribe();
}
