// Not `import { type … }`: that form stays in the output as `import "./auth-client"`,
// which would load the client with this module after all.
type AuthClient = (typeof import("./auth-client"))["authClient"];

/**
 * Better Auth's client (with the passkey plugin and SimpleWebAuthn), fetched
 * the first time a page needs it. The header (on every page), the home
 * page's passkey offer and the account page use it on a button press only
 * (sign out, add or delete a passkey), so they do not load it with the page.
 * The sign-in page, which uses it at once, imports it directly.
 */
export async function loadAuthClient(): Promise<AuthClient> {
  return (await import("./auth-client")).authClient;
}
