import { APIError } from "better-auth/api";

import { isEmailAllowed } from "./sign-in-allowlist";
import { logTurnstileUnconfigured, type TurnstileConfig } from "./turnstile";

/** The endpoint that mails a code; the one Turnstile guards. */
export const SEND_OTP_PATH = "/email-otp/send-verification-otp";
const SIGN_IN_PATHS = new Set([SEND_OTP_PATH, "/sign-in/email-otp"]);

/** The endpoint that stores a new passkey (after the browser made it). */
export const VERIFY_PASSKEY_REGISTRATION_PATH = "/passkey/verify-registration";

/**
 * Endpoints the email OTP plugin mounts outside the sign-in flow, switched
 * off with Better Auth's `disabledPaths` (answered 404). The password-reset
 * ones mail a code to any existing address past Turnstile and
 * `ALLOWED_EMAILS` (the app has no passwords); `check-verification-otp`
 * spends a sign-in code's attempts past the allowlist; the email-change and
 * verification ones are unused. Renaming a passkey is not offered: its label
 * is always the app's own (see `passkeyName`), so the notice mailed when one
 * is added never carries text someone else typed. Re-enable one only
 * together with the checks it needs.
 */
export const DISABLED_AUTH_PATHS = [
  "/email-otp/request-password-reset",
  "/forget-password/email-otp",
  "/email-otp/reset-password",
  "/email-otp/check-verification-otp",
  "/email-otp/verify-email",
  "/email-otp/request-email-change",
  "/email-otp/change-email",
  "/passkey/update-passkey",
];

/**
 * Endpoints that add or remove a passkey. Better Auth authorizes them from the
 * session cookie's 5-minute cache, which outlives a sign-out or revocation;
 * `createAuth` also requires the session in the database for these, so a
 * copied cookie stops working for them the moment its session ends.
 */
export const AUTHORITATIVE_SESSION_PATHS: ReadonlySet<string> = new Set([
  "/passkey/generate-register-options",
  VERIFY_PASSKEY_REGISTRATION_PATH,
  "/passkey/delete-passkey",
]);

/**
 * The checks every Better Auth request passes before its endpoint runs
 * (`hooks.before`); throws the error to answer with.
 *
 * - A deployed Worker without a Turnstile key pair sends no codes at all.
 * - Only sign-in codes may be requested: other kinds (email verification,
 *   password reset) are not part of the app's flow.
 * - Addresses outside `ALLOWED_EMAILS` get neither a code nor a session
 *   (passkey sign-in is checked by {@link assertPasskeyOwnerAllowed}).
 * - A new passkey takes no client-supplied name (it would win over the app's
 *   label, see `DISABLED_AUTH_PATHS`).
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
  const fields = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
  if (path === VERIFY_PASSKEY_REGISTRATION_PATH && fields.name !== undefined) {
    throw new APIError("BAD_REQUEST", { message: "A passkey's name cannot be chosen." });
  }
  if (!SIGN_IN_PATHS.has(path)) {
    return;
  }
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

/**
 * Passkey sign-in names no address, so `guardAuthRequest` cannot check it
 * against `ALLOWED_EMAILS`: this runs once the passkey is verified and before
 * the session is made, and refuses an account whose address is no longer
 * allowed (or a passkey whose account is gone), so removing someone from the
 * list also stops their old passkeys.
 */
export async function assertPasskeyOwnerAllowed({
  credentialId,
  findOwnerEmail,
}: {
  credentialId: string;
  /** The address of the account holding this credential, or `null` when there is none. */
  findOwnerEmail: (credentialId: string) => Promise<string | null>;
}): Promise<void> {
  const email = await findOwnerEmail(credentialId);
  if (email === null || !isEmailAllowed(email)) {
    throw new APIError("FORBIDDEN", { message: "This email address cannot sign in." });
  }
}
