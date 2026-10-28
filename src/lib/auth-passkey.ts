import { getAuthenticatorName, passkey } from "@better-auth/passkey";
import { type BetterAuthPlugin } from "better-auth";

import { APP_NAME } from "./app";
import { assertPasskeyOwnerAllowed } from "./auth-guard";
import { passkeyConfig } from "./passkey";
import { passkeyName } from "./passkey-name";

/**
 * The passkey plugin for `createAuth`, on the hosts `passkeyConfig` allows
 * (none elsewhere). Imported on demand by the auth endpoints only (see
 * `createAuth`), so its WebAuthn and X.509 libraries stay off the cold start
 * of every page and server function.
 *
 * Passkeys are added by a signed-in user only (Better Auth's default, with a
 * session at most a day old), never at sign-up. No Turnstile: signing in with
 * one mails nothing.
 */
export function passkeyPlugins({ request }: { request: Request }): BetterAuthPlugin[] {
  const passkeys = passkeyConfig({ request });
  if (passkeys.status !== "enabled") {
    return [];
  }
  return [
    passkey({
      rpID: passkeys.rpID,
      rpName: APP_NAME,
      origin: passkeys.origin,
      registration: {
        afterVerification: ({ ctx, verification }) => ({
          name: passkeyName({
            provider: getAuthenticatorName(verification.registrationInfo?.aaguid),
            userAgent: ctx.request?.headers.get("user-agent") ?? null,
          }),
        }),
      },
      authentication: {
        // Before the session is made: an account no longer in
        // `ALLOWED_EMAILS` does not sign in with an old passkey.
        afterVerification: async ({ ctx, clientData }) => {
          await assertPasskeyOwnerAllowed({
            credentialId: clientData.id,
            findOwnerEmail: async (credentialID) => {
              const stored = await ctx.context.adapter.findOne<{ userId: string }>({
                model: "passkey",
                where: [{ field: "credentialID", value: credentialID }],
              });
              if (!stored) {
                return null;
              }
              const owner = await ctx.context.internalAdapter.findUserById(stored.userId);
              return owner?.email ?? null;
            },
          });
        },
      },
    }),
  ];
}
