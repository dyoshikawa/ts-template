import { authClient } from "./auth-client";
import { passkeyRegistrationErrorMessage } from "./passkey-browser";

/**
 * Asks the browser for a new passkey and stores it on the signed-in account.
 * Resolves to `ok` once stored, `cancelled` when the user closed the dialog,
 * or the message to show.
 */
export async function addPasskey(): Promise<
  { status: "ok" } | { status: "cancelled" } | { status: "failed"; message: string }
> {
  const { error } = await authClient.passkey.addPasskey();
  if (!error) {
    return { status: "ok" };
  }
  const message = passkeyRegistrationErrorMessage(error);
  return message === null ? { status: "cancelled" } : { status: "failed", message };
}
