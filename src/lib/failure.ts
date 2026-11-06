import { isNotFound } from "@tanstack/react-router";

import { type Messages } from "../i18n/messages";
import { UNREACHABLE } from "./unreachable";

/**
 * What kind of failure a request met, as far as the browser can tell. Every
 * failure the app shows says its kind (and what to do about it), never only
 * that something failed:
 * - `offline`: the request never reached the server;
 * - `timeout`: the server did not answer in time;
 * - `rateLimited`: asked too often; `retryAt` (epoch ms) when the server said;
 * - `signedOut`: the session is gone (401);
 * - `forbidden`: the server refused the action (403);
 * - `notFound`: what was asked for does not exist (404, 410, a router `notFound`);
 * - `refused`: the server turned the request down (another 4xx);
 * - `server`: the server failed (5xx); `status` is `null` when a server
 *   function's failure arrived without one;
 * - `unexpected`: the page itself went wrong (a bug, not the network).
 */
export type Failure =
  | { readonly kind: "offline" }
  | { readonly kind: "timeout" }
  | { readonly kind: "rateLimited"; readonly retryAt: number | null }
  | { readonly kind: "signedOut" }
  | { readonly kind: "forbidden" }
  | { readonly kind: "notFound" }
  | { readonly kind: "refused"; readonly status: number }
  | { readonly kind: "server"; readonly status: number | null }
  | { readonly kind: "unexpected" };

/**
 * Messages of the `TypeError` a failed `fetch` (or a failed chunk import)
 * rejects with — Chromium, Firefox and Safari word it differently. Any other
 * `TypeError` is a bug in the page, not the network.
 */
const NETWORK_MESSAGE =
  /failed to fetch|networkerror|network request failed|load failed|importing a module|dynamically imported module/iu;

/** Seconds as a number, from a header or a JSON field; `null` when unusable. */
function seconds(value: unknown): number | null {
  const parsed = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  return typeof parsed === "number" && Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function byStatus({
  status,
  retryAfter,
  now,
}: {
  status: number;
  retryAfter: number | null;
  now: number;
}): Failure {
  if (status === 429) {
    return { kind: "rateLimited", retryAt: retryAfter === null ? null : now + retryAfter * 1000 };
  }
  if (status === 401) return { kind: "signedOut" };
  if (status === 403) return { kind: "forbidden" };
  if (status === 404 || status === 410) return { kind: "notFound" };
  if (status === 408) return { kind: "timeout" };
  if (status >= 500) return { kind: "server", status };
  if (status >= 400) return { kind: "refused", status };
  return { kind: "unexpected" };
}

/**
 * Sorts whatever a call threw or returned as its error into its kind:
 * - a thrown `Response` (a server function's refusal arrives that way, with
 *   its status and any `Retry-After`);
 * - Better Auth's client error, `{ status, code, retryAfter }` — with the
 *   `UNREACHABLE` code when the request never left (src/lib/unreachable.ts);
 * - the `TypeError` of a `fetch` that never reached the server, told apart
 *   from a bug by its message;
 * - a timeout's `TimeoutError`, the router's `notFound`;
 * - a plain `Error`: a server function's failure without a status (its
 *   exception, or an answer that was not its own, reaches the page so).
 * A failure without a status while the browser says it is offline is `offline`.
 */
export function classifyFailure(error: unknown, { now = Date.now() } = {}): Failure {
  const failure = classifyAnswer(error, now);
  // The browser's word for being offline outweighs only a failure the server
  // did not answer for: a status is the server's own say.
  const unanswered =
    failure.kind === "unexpected" || (failure.kind === "server" && failure.status === null);
  if (unanswered && typeof navigator !== "undefined" && navigator.onLine === false) {
    return { kind: "offline" };
  }
  return failure;
}

function classifyAnswer(error: unknown, now: number): Failure {
  if (error instanceof DOMException && error.name === "TimeoutError") {
    return { kind: "timeout" };
  }
  if (isNotFound(error)) {
    return { kind: "notFound" };
  }
  if (error instanceof Response) {
    const retryAfter = seconds(
      error.headers.get("X-Retry-After") ?? error.headers.get("Retry-After"),
    );
    return byStatus({ status: error.status, retryAfter, now });
  }
  if (error instanceof Error) {
    if (NETWORK_MESSAGE.test(error.message)) {
      return { kind: "offline" };
    }
    // Only a plain Error is the server's; a TypeError or ReferenceError is the page's own bug.
    return error.constructor === Error ? { kind: "server", status: null } : { kind: "unexpected" };
  }
  if (typeof error === "object" && error !== null) {
    const { status, code, retryAfter } = error as {
      status?: unknown;
      code?: unknown;
      retryAfter?: unknown;
    };
    if (code === UNREACHABLE) {
      return { kind: "offline" };
    }
    if (typeof status === "number") {
      return byStatus({ status, retryAfter: seconds(retryAfter), now });
    }
  }
  return { kind: "unexpected" };
}

/** The sentence saying which kind of failure it was and what can be done about it. */
export function failureText({
  failure,
  t,
  locale,
}: {
  failure: Failure;
  t: Messages;
  /** The `Intl` locale, for a rate limit's reset time. */
  locale: string;
}): string {
  const text = t.failure;
  switch (failure.kind) {
    case "rateLimited": {
      if (failure.retryAt === null) {
        return text.rateLimited;
      }
      // Rounded up to the minute shown, so trying at that time works.
      const at = Math.ceil(failure.retryAt / 60_000) * 60_000;
      return text.rateLimitedUntil({
        time: new Intl.DateTimeFormat(locale, { timeStyle: "short" }).format(at),
      });
    }
    case "refused": {
      return text.refused({ status: failure.status });
    }
    case "server": {
      return failure.status === null
        ? text.serverNoStatus
        : text.server({ status: failure.status });
    }
    default: {
      return text[failure.kind];
    }
  }
}

/**
 * A failed action's own sentence ("Could not delete the passkey.") followed
 * by the kind of failure `error` was, as one text.
 */
export function failureNotice({
  action,
  error,
  t,
  locale,
}: {
  action: string;
  error: unknown;
  t: Messages;
  locale: string;
}): string {
  return t.failure.withKind({
    action,
    kind: failureText({ failure: classifyFailure(error), t, locale }),
  });
}
