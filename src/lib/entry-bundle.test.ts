import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vite-plus/test";

/**
 * Better Auth's client (with the passkey plugin and SimpleWebAuthn) belongs
 * to the sign-in page. Everywhere else it is used on a button press only and
 * fetched then (`loadAuthClient`), so the header on every page, the home page
 * and the account page do not load it with the page.
 */
describe("the auth client", () => {
  it("is fetched on demand outside the sign-in page", () => {
    for (const file of [
      "routes/__root.tsx",
      "components/header.tsx",
      "components/passkey-offer.tsx",
      "routes/index.tsx",
      "routes/account.tsx",
      "lib/passkey-actions.ts",
      "lib/load-auth-client.ts",
    ]) {
      const source = readFileSync(join(import.meta.dirname, "..", file), "utf8");
      // `import { type … }` counts too: it stays in the output as a bare import.
      expect(source, file).not.toMatch(
        /from "(?:\.\.?\/lib\/|\.\/)auth-client"|from "better-auth/u,
      );
    }
  });
});
