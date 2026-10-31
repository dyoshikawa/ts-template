import { useSyncExternalStore } from "react";

import { type Messages } from "../i18n/messages";
import { APP_NAME } from "./app";

/**
 * Browser-side helpers for passkeys: whether the browser can use them, the
 * one-time offer after an email sign-in, and the messages shown for the
 * errors Better Auth's passkey client returns (keyed by `code`).
 */

/** Whether this browser has WebAuthn at all. */
function passkeysSupported(): boolean {
  return typeof window !== "undefined" && typeof window.PublicKeyCredential === "function";
}

/** Never changes while the page is open; there is nothing to subscribe to. */
function subscribeNever(): () => void {
  return () => {};
}

/**
 * {@link passkeysSupported} as a hook: false on the server render and while
 * hydrating, so the markup matches, then the browser's answer.
 */
export function usePasskeysSupported(): boolean {
  return useSyncExternalStore(subscribeNever, passkeysSupported, () => false);
}

/** Set by an email sign-in, read by the home page. */
const OFFER_KEY = `${APP_NAME}:passkey-offer`;
/** Set on this device by "Not now"; the offer is not shown here again. */
const DECLINED_KEY = `${APP_NAME}:passkey-offer-declined`;

/** Storage can be missing or throw (private windows, blocked site data); the offer is then skipped. */
function storage(kind: "session" | "local"): Storage | null {
  try {
    return kind === "session" ? window.sessionStorage : window.localStorage;
  } catch {
    return null;
  }
}

function safely(run: () => void): void {
  try {
    run();
  } catch {
    // A full or blocked storage only costs the offer.
  }
}

const offerListeners = new Set<() => void>();

function subscribeOffer(listener: () => void): () => void {
  offerListeners.add(listener);
  return () => {
    offerListeners.delete(listener);
  };
}

/**
 * Set while the home page shows the offer: the stored request is used up as
 * soon as the offer is on screen, so a reload or a later visit does not show
 * it again, while this page keeps showing it until it is left or answered.
 */
let offerOnScreen = false;

function offerPending(): boolean {
  return (
    (offerOnScreen || storage("session")?.getItem(OFFER_KEY) === "1") &&
    storage("local")?.getItem(DECLINED_KEY) !== "1" &&
    passkeysSupported()
  );
}

/** Remembers that the user just signed in by email, so the home page may offer a passkey. */
export function requestPasskeyOffer(): void {
  safely(() => storage("session")?.setItem(OFFER_KEY, "1"));
}

/**
 * Whether to offer a passkey: after an email sign-in, until the offer is
 * answered or left (`endPasskeyOffer`), unless declined on this device.
 * False on the server render and while hydrating.
 */
export function usePasskeyOfferPending(): boolean {
  return useSyncExternalStore(subscribeOffer, offerPending, () => false);
}

/** How many offers are mounted; see {@link showPasskeyOffer}. */
let offersMounted = 0;

/**
 * The offer is on screen: its stored request is used up (see
 * `offerOnScreen`). Returns the cleanup that ends it when the page leaves.
 * The end waits a task and is skipped when the offer was mounted again in
 * between, which is what React's StrictMode does in development (mount,
 * unmount, mount): a cleanup that ended it at once would hide it for good.
 */
export function showPasskeyOffer(): () => void {
  offersMounted += 1;
  if (offerPending()) {
    offerOnScreen = true;
    safely(() => storage("session")?.removeItem(OFFER_KEY));
  }
  return () => {
    offersMounted -= 1;
    setTimeout(() => {
      if (offersMounted === 0) {
        endPasskeyOffer();
      }
    }, 0);
  };
}

/** The offer was answered or left behind: it is not shown again until the next email sign-in. */
export function endPasskeyOffer(): void {
  offerOnScreen = false;
  safely(() => storage("session")?.removeItem(OFFER_KEY));
  for (const listener of offerListeners) {
    listener();
  }
}

/** "Not now": no more offers on this device (the account page still adds one). */
export function declinePasskeyOffer(): void {
  safely(() => storage("local")?.setItem(DECLINED_KEY, "1"));
  endPasskeyOffer();
}

/**
 * Closing the browser's dialog: nothing went wrong, so nothing alarming is
 * shown. Browsers report a cancel (and a timeout) as `NotAllowedError`, which
 * SimpleWebAuthn passes through as `ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY`; an
 * abort (another passkey prompt took over) is `ERROR_CEREMONY_ABORTED`.
 * Better Auth's `AUTH_CANCELLED` is not one: the client also reports a
 * failed request (offline, server error) under that code.
 */
const CANCELLED_CODES = new Set(["ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY", "ERROR_CEREMONY_ABORTED"]);

/** What to tell the user when adding a passkey failed; `null` when they cancelled. */
export function passkeyRegistrationErrorMessage({
  error,
  t,
}: {
  error: { status: number; code?: string | undefined };
  t: Messages;
}): string | null {
  if (error.code !== undefined && CANCELLED_CODES.has(error.code)) {
    return null;
  }
  switch (error.code) {
    // The session is older than Better Auth's `freshAge` (a day). Sessions
    // last 90 days, so this is the usual case for a returning user.
    case "SESSION_NOT_FRESH":
      return t.passkeys.needsFreshSignIn;
    case "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED":
      return t.passkeys.errors.alreadyRegistered;
    default:
      return t.passkeys.errors.addFailed;
  }
}

/** What to tell the user when signing in with a passkey failed; `null` when they cancelled. */
export function passkeySignInErrorMessage({
  error,
  t,
}: {
  error: { status: number; code?: string | undefined };
  t: Messages;
}): string | null {
  if (error.code !== undefined && CANCELLED_CODES.has(error.code)) {
    return null;
  }
  if (error.code === "PASSKEY_NOT_FOUND") {
    return t.passkeys.errors.notFound;
  }
  if (error.status === 403) {
    return t.passkeys.errors.forbidden;
  }
  return t.passkeys.errors.signInFailed;
}
