import { env } from "cloudflare:workers";

import { isLocalRequest } from "./local-request";

/**
 * Cloudflare's documented test keys: the widget always passes and the secret
 * always verifies. Stand-ins for an unconfigured key pair on local runs only
 * (`vp dev`, the emulator); a deployed Worker without its own keys fails
 * closed instead of silently letting every challenge pass.
 * https://developers.cloudflare.com/turnstile/troubleshooting/testing/
 */
const TEST_SITE_KEY = "1x00000000000000000000AA";
const TEST_SECRET_KEY = "1x0000000000000000000000000000000AA";

/**
 * How Turnstile guards a request:
 * - `enabled`: the widget renders with `siteKey`, tokens are checked with `secretKey`;
 * - `disabled`: switched off for a local run (`TURNSTILE_DISABLED`) — no widget,
 *   every token verifies;
 * - `unconfigured`: a deployed Worker without a full key pair — every guarded
 *   action is refused.
 */
export type TurnstileConfig =
  | { status: "enabled"; siteKey: string; secretKey: string }
  | { status: "disabled" }
  | { status: "unconfigured" };

/** What the browser needs of a {@link TurnstileConfig}: never the secret. */
export type TurnstileClientConfig =
  | { status: "enabled"; siteKey: string }
  | { status: "disabled" }
  | { status: "unconfigured" };

/**
 * Whether Turnstile is switched off with `TURNSTILE_DISABLED=1`: no widget is
 * rendered and every token verifies. For local runs and browser tests only,
 * so it is only honoured for requests to a local address — set on the
 * deployed Worker by mistake, it changes nothing.
 */
function turnstileDisabled({ request }: { request: Request }): boolean {
  return (
    (env.TURNSTILE_DISABLED === "1" || env.TURNSTILE_DISABLED === "true") && isLocalRequest(request)
  );
}

/** Resolves the Turnstile setup for one request; see {@link TurnstileConfig}. */
export function turnstileConfig({ request }: { request: Request }): TurnstileConfig {
  if (turnstileDisabled({ request })) {
    return { status: "disabled" };
  }
  if (import.meta.env.DEV || isLocalRequest(request)) {
    return {
      status: "enabled",
      siteKey: env.TURNSTILE_SITE_KEY || TEST_SITE_KEY,
      secretKey: env.TURNSTILE_SECRET_KEY || TEST_SECRET_KEY,
    };
  }
  if (!env.TURNSTILE_SITE_KEY || !env.TURNSTILE_SECRET_KEY) {
    return { status: "unconfigured" };
  }
  return {
    status: "enabled",
    siteKey: env.TURNSTILE_SITE_KEY,
    secretKey: env.TURNSTILE_SECRET_KEY,
  };
}

/**
 * What a widget is solved for, sent to Turnstile as its `action` and checked
 * on the server, so a token solved on one form (deleting the account) cannot
 * be spent on another (sending or entering a sign-in code).
 */
export type TurnstileAction = "sign-in" | "delete-account";

/**
 * The hostname and action a token must report back, or `null` on local runs:
 * Cloudflare's test keys (see `TEST_SITE_KEY`) report neither, so a local run
 * checks only that the token passed. On a deployed Worker the token must have
 * been solved on the hostname the request is served from.
 */
export function turnstileBinding({ request }: { request: Request }): { hostname: string } | null {
  if (import.meta.env.DEV || isLocalRequest(request)) {
    return null;
  }
  return { hostname: new URL(request.url).hostname };
}

/** The part of the setup the widget renders from. */
export function turnstileClientConfig({ request }: { request: Request }): TurnstileClientConfig {
  const config = turnstileConfig({ request });
  return config.status === "enabled" ? { status: "enabled", siteKey: config.siteKey } : config;
}

/** Logged whenever an unconfigured Worker refuses a guarded action. */
export function logTurnstileUnconfigured(): void {
  // oxlint-disable-next-line no-console
  console.error(
    "[turnstile] TURNSTILE_SITE_KEY / TURNSTILE_SECRET_KEY are not set; refusing the request",
  );
}

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/**
 * Whether a widget token is genuine and was solved for `action` on this app's
 * hostname (see `turnstileBinding`), checked with Cloudflare; a token is
 * single-use.
 */
export async function verifyTurnstile({
  request,
  token,
  remoteIp,
  action,
}: {
  request: Request;
  token: string;
  remoteIp: string | null;
  action: TurnstileAction;
}): Promise<boolean> {
  const config = turnstileConfig({ request });
  if (config.status === "disabled") {
    return true;
  }
  if (config.status === "unconfigured") {
    logTurnstileUnconfigured();
    return false;
  }
  const body = new URLSearchParams({
    secret: config.secretKey,
    response: token,
  });
  if (remoteIp) {
    body.set("remoteip", remoteIp);
  }
  const response = await fetch(VERIFY_URL, { method: "POST", body });
  if (!response.ok) {
    return false;
  }
  const result = (await response.json()) as {
    success?: boolean;
    hostname?: string;
    action?: string;
  };
  if (result.success !== true) {
    return false;
  }
  const binding = turnstileBinding({ request });
  return binding === null || (result.hostname === binding.hostname && result.action === action);
}
