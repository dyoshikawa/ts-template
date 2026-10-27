import { env } from "cloudflare:workers";

import { isLocalRequest } from "./local-request";

/**
 * Whether passkeys are offered for a request, and for which relying party.
 *
 * A passkey is bound to one domain (the RP ID), so the deployed Worker offers
 * them on the hostname in `PASSKEY_RP_ID` only (the app's custom domain): a
 * passkey made on the workers.dev host would not work on the custom domain and
 * vice versa, so every other host signs in by email alone. Unset (the
 * template's default), the deployed Worker offers no passkeys at all. Local
 * runs (`pnpm dev`, `pnpm dev:cf`, browser tests) use `localhost` on the
 * default ports ({@link LOCAL_ORIGINS}).
 */
export type PasskeyConfig =
  | { status: "enabled"; rpID: string; origin: string[] }
  | { status: "disabled" };

/**
 * Where local runs are served: `pnpm dev:cf` and the browser tests
 * (`scripts/cf-dev.mjs`, 4173) and `pnpm dev` (Vite, 5173). Listed rather than
 * read from the request because the emulator rewrites the URL and the
 * `Origin` header to the custom domain once `routes` names one; passkeys do
 * not work on other ports.
 */
const LOCAL_ORIGINS = ["http://localhost:4173", "http://localhost:5173"];

export function passkeyConfig({ request }: { request: Request }): PasskeyConfig {
  // Checked first: the emulator rewrites the URL to the custom domain.
  if (import.meta.env.DEV || isLocalRequest(request)) {
    return { status: "enabled", rpID: "localhost", origin: LOCAL_ORIGINS };
  }
  const rpID = env.PASSKEY_RP_ID?.trim();
  if (rpID && new URL(request.url).hostname === rpID) {
    return { status: "enabled", rpID, origin: [`https://${rpID}`] };
  }
  return { status: "disabled" };
}
