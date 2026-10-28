import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createAuth } from "./auth";
import { passkeyPlugins } from "./auth-passkey";

/** The stand-in `env` as a bag of variables. */
const vars = env as unknown as Record<string, string | undefined>;

const deployed = new Request("https://app.example.com/api/auth/get-session");
const local = new Request("http://localhost:4173/api/auth/get-session");

beforeEach(() => {
  // Run as the built Worker does unless a test says otherwise.
  vi.stubEnv("DEV", false);
  // A refused request logs why; keep that out of the test output.
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  for (const key of Object.keys(vars)) {
    delete vars[key];
  }
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("createAuth", () => {
  it("refuses to run without BETTER_AUTH_SECRET outside `vite dev`", () => {
    expect(() => createAuth({ request: deployed })).toThrow("BETTER_AUTH_SECRET");
    // Nor with the secret Better Auth would fall back to, which is public.
    vars.BETTER_AUTH_SECRET = "better-auth-secret-12345678901234567890";
    expect(() => createAuth({ request: deployed })).toThrow("BETTER_AUTH_SECRET");
  });

  it("runs on its own secret under `vite dev`", () => {
    vi.stubEnv("DEV", true);
    expect(() => createAuth({ request: local })).not.toThrow();
  });

  it("names cookies with the __Host- prefix on https, and plainly on http", async () => {
    vars.BETTER_AUTH_SECRET = "a-test-secret-that-is-long-enough-1234567890";
    const https = await createAuth({ request: deployed }).$context;
    expect(https.authCookies.sessionToken.name).toBe("__Host-better-auth.session_token");
    expect(https.authCookies.sessionData.name).toBe("__Host-better-auth.session_data");
    for (const cookie of Object.values(https.authCookies)) {
      expect(cookie.attributes).toMatchObject({ secure: true, path: "/" });
      expect(cookie.attributes).not.toHaveProperty("domain");
    }
    // The passkey plugin's challenge cookie (on the endpoints' instance,
    // the one with the plugin) is named the same way.
    vars.PASSKEY_RP_ID = "app.example.com";
    const endpoints = await createAuth({
      request: deployed,
      passkeys: passkeyPlugins({ request: deployed }),
    }).$context;
    expect(endpoints.createAuthCookie("better-auth-passkey").name).toBe(
      "__Host-better-auth.better-auth-passkey",
    );
    expect(endpoints.options.plugins?.map((plugin) => plugin.id)).toContain("passkey");

    const http = await createAuth({ request: local }).$context;
    expect(http.authCookies.sessionToken.name).toBe("better-auth.session_token");
  });
});
