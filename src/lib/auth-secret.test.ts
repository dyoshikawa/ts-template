import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resolveAuthSecret } from "./auth-secret";

/** The stand-in `env` as a bag of variables. */
const vars = env as unknown as Record<string, string | undefined>;

const local = new Request("http://localhost:4173/api/auth/get-session");
const deployed = new Request("https://app.example.com/api/auth/get-session");

const SECRET = "0123456789abcdef0123456789abcdef0123456789abcdef";
const DEV_SECRET = "insecure-dev-only-secret-do-not-use-in-production";

/** Stands in for `console.error`, which a refused request logs to. */
const logged = vi.fn();

beforeEach(() => {
  logged.mockClear();
  // Run as the built Worker does unless a test says otherwise, whatever the
  // test runner sets `DEV` to.
  vi.stubEnv("DEV", false);
  vi.spyOn(console, "error").mockImplementation(logged);
});

afterEach(() => {
  for (const key of Object.keys(vars)) {
    delete vars[key];
  }
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("resolveAuthSecret", () => {
  it("uses the configured secret on a deployed Worker", () => {
    vars.BETTER_AUTH_SECRET = SECRET;
    expect(resolveAuthSecret({ request: deployed })).toBe(SECRET);
  });

  it("keeps the configured secret as given, surrounding whitespace included", () => {
    vars.BETTER_AUTH_SECRET = `${SECRET}\n`;
    expect(resolveAuthSecret({ request: deployed })).toBe(`${SECRET}\n`);
  });

  it("refuses a deployed Worker without a secret instead of using Better Auth's default", () => {
    expect(() => resolveAuthSecret({ request: deployed })).toThrow(
      "BETTER_AUTH_SECRET is not configured",
    );
    expect(logged).toHaveBeenCalledOnce();
  });

  it("refuses an empty or whitespace-only secret on a deployed Worker", () => {
    vars.BETTER_AUTH_SECRET = "";
    expect(() => resolveAuthSecret({ request: deployed })).toThrow();
    vars.BETTER_AUTH_SECRET = "   ";
    expect(() => resolveAuthSecret({ request: deployed })).toThrow();
  });

  it("refuses a secret shorter than 32 characters on a deployed Worker", () => {
    vars.BETTER_AUTH_SECRET = "a".repeat(31);
    expect(() => resolveAuthSecret({ request: deployed })).toThrow();
    // Padding a pasted value with a newline does not make it long enough.
    vars.BETTER_AUTH_SECRET = `${"a".repeat(31)}\n`;
    expect(() => resolveAuthSecret({ request: deployed })).toThrow();
    vars.BETTER_AUTH_SECRET = "a".repeat(32);
    expect(resolveAuthSecret({ request: deployed })).toBe("a".repeat(32));
  });

  it("refuses Better Auth's public default secret on a deployed Worker", () => {
    vars.BETTER_AUTH_SECRET = "better-auth-secret-12345678901234567890";
    expect(() => resolveAuthSecret({ request: deployed })).toThrow(
      "BETTER_AUTH_SECRET is not configured",
    );
    vars.BETTER_AUTH_SECRET = " better-auth-secret-12345678901234567890\n";
    expect(() => resolveAuthSecret({ request: deployed })).toThrow();
  });

  it("falls back to the development secret on a local address", () => {
    expect(resolveAuthSecret({ request: local })).toBe(DEV_SECRET);
    vars.BETTER_AUTH_SECRET = "short-local-secret";
    expect(resolveAuthSecret({ request: local })).toBe("short-local-secret");
  });

  it("falls back to the development secret for an emulator request from a loopback client", () => {
    const emulated = new Request("https://app.example.com/api/auth/get-session", {
      headers: { "CF-Connecting-IP": "127.0.0.1" },
    });
    expect(resolveAuthSecret({ request: emulated })).toBe(DEV_SECRET);
  });

  it("falls back to the development secret under `vite dev`", () => {
    vi.stubEnv("DEV", true);
    expect(resolveAuthSecret({ request: deployed })).toBe(DEV_SECRET);
    expect(logged).not.toHaveBeenCalled();
  });
});
