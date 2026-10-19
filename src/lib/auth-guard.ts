import { APIError } from "better-auth/api";

import { isEmailAllowed } from "./sign-in-allowlist";
import { logTurnstileUnconfigured, type TurnstileConfig } from "./turnstile";

/** The endpoint that mails a code; the one Turnstile guards. */
export const SEND_OTP_PATH = "/email-otp/send-verification-otp";
const SIGN_IN_PATHS = new Set([SEND_OTP_PATH, "/sign-in/email-otp"]);

/**
 * Endpoints the email OTP plugin mounts outside the sign-in flow, switched
 * off with Better Auth's `disabledPaths` (answered 404). The password-reset
 * ones mail a code to any existing address past Turnstile and
 * `ALLOWED_EMAILS` (the app has no passwords); `check-verification-otp`
 * spends a sign-in code's attempts past the allowlist; the email-change and
 * verification ones are unused. Re-enable one only together with the checks
 * it needs.
 */
export const DISABLED_AUTH_PATHS = [
  "/email-otp/request-password-reset",
  "/forget-password/email-otp",
  "/email-otp/reset-password",
  "/email-otp/check-verification-otp",
  "/email-otp/verify-email",
  "/email-otp/request-email-change",
  "/email-otp/change-email",
];

/**
 * The checks every Better Auth request passes before its endpoint runs
 * (`hooks.before`); throws the error to answer with.
 *
 * - A deployed Worker without a Turnstile key pair sends no codes at all.
 * - Only sign-in codes may be requested: other kinds (email verification,
 *   password reset) are not part of the app's flow.
 * - Addresses outside `ALLOWED_EMAILS` get neither a code nor a session.
 */
export function guardAuthRequest({
  path,
  body,
  turnstile,
}: {
  path: string;
  body: unknown;
  turnstile: TurnstileConfig;
}): void {
  if (!SIGN_IN_PATHS.has(path)) {
    return;
  }
  const fields = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
  if (path === SEND_OTP_PATH) {
    if (turnstile.status === "unconfigured") {
      logTurnstileUnconfigured();
      throw new APIError("SERVICE_UNAVAILABLE", {
        message: "Sign-in is not available: the verification check is not set up.",
      });
    }
    if (fields.type !== "sign-in") {
      throw new APIError("BAD_REQUEST", { message: "Only sign-in codes can be requested." });
    }
  }
  if (typeof fields.email === "string" && !isEmailAllowed(fields.email)) {
    throw new APIError("FORBIDDEN", { message: "This email address cannot sign in." });
  }
}
