import { env } from "cloudflare:workers";

import { isLocalRequest } from "./local-request";

/**
 * Cloudflare's documented test keys: the widget always passes and the secret
 * always verifies. Stand-ins for an unconfigured key pair on local runs only
 * (`vite dev`, the emulator); a deployed Worker without its own keys fails
 * closed instead of silently letting every challenge pass.
 * https://developers.cloudflare.com/turnstile/troubleshooting/testing/
 */
const TEST_SITE_KEY = "1x00000000000000000000AA";
const TEST_SECRET_KEY = "1x0000000000000000000000000000000AA";

/**
 * Whether Turnstile is switched off with `TURNSTILE_DISABLED=1`: no widget is
 * rendered and every token verifies. For local runs and browser tests only,
 * so it is only honoured for requests to a local address — set on the
 * deployed Worker by mistake, it changes nothing.
 */
export function turnstileDisabled({ request }: { request: Request }): boolean {
  return (
    (env.TURNSTILE_DISABLED === "1" || env.TURNSTILE_DISABLED === "true") && isLocalRequest(request)
  );
}

/** Whether an unconfigured key falls back to the always-passing test keys. */
function testKeysAllowed({ request }: { request: Request }): boolean {
  return import.meta.env.DEV || isLocalRequest(request);
}

/**
 * The secret the widget tokens are verified with, or `undefined` when none is
 * configured on a deployed Worker — callers must then refuse every token.
 */
export function turnstileSecretKey({ request }: { request: Request }): string | undefined {
  return env.TURNSTILE_SECRET_KEY || (testKeysAllowed({ request }) ? TEST_SECRET_KEY : undefined);
}

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/**
 * The site key the widget renders with; empty when Turnstile is disabled, or
 * when none is configured on a deployed Worker (the server then refuses every
 * token, as its secret is missing too).
 */
export function turnstileSiteKey({ request }: { request: Request }): string {
  if (turnstileDisabled({ request })) {
    return "";
  }
  return env.TURNSTILE_SITE_KEY || (testKeysAllowed({ request }) ? TEST_SITE_KEY : "");
}

/** Whether a widget token is genuine, checked with Cloudflare; a token is single-use. */
export async function verifyTurnstile({
  request,
  token,
  remoteIp,
}: {
  request: Request;
  token: string;
  remoteIp: string | null;
}): Promise<boolean> {
  if (turnstileDisabled({ request })) {
    return true;
  }
  const secret = turnstileSecretKey({ request });
  if (!secret) {
    return false;
  }
  const body = new URLSearchParams({
    secret,
    response: token,
  });
  if (remoteIp) {
    body.set("remoteip", remoteIp);
  }
  const response = await fetch(VERIFY_URL, { method: "POST", body });
  if (!response.ok) {
    return false;
  }
  const result = (await response.json()) as { success?: boolean };
  return result.success === true;
}
