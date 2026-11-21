import * as z from "zod/mini";

// The subscription check on its own, apart from the push storage in
// `push.ts`: the server function stubs a page renders with keep their
// validators, so whatever this module imports is loaded by every page.

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

const base64Url = z.string().check(z.minLength(1), z.maxLength(256), z.regex(/^[\w-]+$/u));

/** A subscription as the browser hands it over, checked before it is stored. */
export const subscriptionInput = z.object({
  endpoint: z
    .string()
    .check(z.maxLength(2048), z.refine(isPushServiceEndpoint, "Not a known push service endpoint")),
  p256dh: base64Url,
  auth: base64Url,
});
