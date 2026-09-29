import { env } from "cloudflare:workers";

/**
 * The addresses allowed to sign in, from `ALLOWED_EMAILS` (comma-separated,
 * case-insensitive). Empty means everybody may sign in — the deployed Worker
 * sets the secret to keep the app private, local runs leave it unset.
 */
export function parseAllowedEmails(value: string | undefined): Set<string> {
  return new Set(
    (value ?? "")
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter((entry) => entry !== ""),
  );
}

/** Whether `email` may request a sign-in code and sign in. */
export function isEmailAllowed(email: string, allowed = env.ALLOWED_EMAILS): boolean {
  const list = parseAllowedEmails(allowed);
  return list.size === 0 || list.has(email.trim().toLowerCase());
}
