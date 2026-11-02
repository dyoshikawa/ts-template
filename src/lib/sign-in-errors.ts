import { type Messages } from "../i18n/messages";

/** The `code` the auth guard answers with when an address may not sign in. */
export const EMAIL_NOT_ALLOWED = "EMAIL_NOT_ALLOWED";

/** The `code` the auth guard answers with when a Worker has no Turnstile key pair. */
export const SIGN_IN_UNAVAILABLE = "SIGN_IN_UNAVAILABLE";

/** What Better Auth's client reports for a refused request. */
type AuthError = { status: number; code?: string | undefined };

/**
 * The message for a failed sign-in step, in the page's language. The server
 * answers with codes (the email OTP and captcha plugins' own, and the auth
 * guard's), never with text the page shows, so each is translated here;
 * anything else gets the step's general message.
 */
export function signInErrorMessage({
  error,
  step,
  t,
}: {
  error: AuthError;
  /** Sending the code, or checking it. */
  step: "send" | "verify";
  t: Messages;
}): string {
  const errors = t.login.errors;
  if (error.status === 429) {
    return errors.rateLimited;
  }
  switch (error.code) {
    case EMAIL_NOT_ALLOWED:
      return errors.notAllowed;
    case SIGN_IN_UNAVAILABLE:
      return errors.unavailable;
    case "INVALID_OTP":
      return errors.verifyFailed;
    case "OTP_EXPIRED":
      return errors.expired;
    case "TOO_MANY_ATTEMPTS":
      return errors.tooManyAttempts;
    case "VERIFICATION_FAILED":
    case "MISSING_RESPONSE":
      return errors.checkFailed;
    default:
      return step === "send" ? errors.sendFailed : errors.verifyFailed;
  }
}
