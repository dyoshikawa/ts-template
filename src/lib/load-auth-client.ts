// Not `import { type … }`: that form stays in the output as `import "./auth-client"`,
// which would load the client with this module after all.
type AuthClient = (typeof import("./auth-client"))["authClient"];

let pending: Promise<AuthClient | null> | undefined;

/**
 * Better Auth's client (with the passkey plugin and SimpleWebAuthn), fetched
 * the first time a page needs it. The header (on every page), the home
 * page's passkey offer and the account page use it on a button press only
 * (sign out, add or delete a passkey), so they do not load it with the page.
 * The sign-in page, which uses it at once, imports it directly.
 *
 * Resolves to `null` when the chunk cannot be fetched (offline, or a tab
 * left open across a deploy that removed it); a later call tries again.
 */
export function loadAuthClient(): Promise<AuthClient | null> {
  pending ??= import("./auth-client").then(
    ({ authClient }) => authClient,
    () => {
      pending = undefined;
      return null;
    },
  );
  return pending;
}

/**
 * Starts fetching the client before a button needs it. Adding a passkey must
 * reach `navigator.credentials.create` while the press still counts as a user
 * gesture (Safari), so screens offering it call this when they show the
 * button rather than spending that time on the fetch.
 */
export function preloadAuthClient(): void {
  void loadAuthClient();
}
