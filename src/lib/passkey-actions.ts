import { type Messages } from "../i18n/messages";
import { loadAuthClient } from "./load-auth-client";
import { passkeyRegistrationErrorMessage } from "./passkey-browser";
import { UNREACHABLE } from "./unreachable";

/**
 * Asks the browser for a new passkey and stores it on the signed-in account.
 * Resolves to `ok` once stored, `cancelled` when the user closed the dialog,
 * or the message to show (in the language of `t`).
 */
export async function addPasskey({
  t,
  locale,
}: {
  t: Messages;
  locale: string;
}): Promise<{ status: "ok" } | { status: "cancelled" } | { status: "failed"; message: string }> {
  // Fetched on demand (see `loadAuthClient`); a failed fetch reads like a
  // failed request, the way the client reports one.
  const authClient = await loadAuthClient();
  const { error } = authClient
    ? await authClient.passkey.addPasskey()
    : { error: { status: 503, code: UNREACHABLE } };
  if (!error) {
    return { status: "ok" };
  }
  const message = passkeyRegistrationErrorMessage({ error, t, locale });
  return message === null ? { status: "cancelled" } : { status: "failed", message };
}
