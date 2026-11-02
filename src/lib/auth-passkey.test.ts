import { readFileSync } from "node:fs";
import { join } from "node:path";

import { env } from "cloudflare:workers";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { passkeyPlugins } from "./auth-passkey";

/** The stand-in `env` as a bag of variables. */
const vars = env as unknown as Record<string, string | undefined>;

afterEach(() => {
  for (const key of Object.keys(vars)) {
    delete vars[key];
  }
  vi.unstubAllEnvs();
});

describe("passkeyPlugins", () => {
  it("gives the passkey plugin on a host that offers passkeys, and nothing elsewhere", () => {
    vi.stubEnv("DEV", false);
    vars.PASSKEY_RP_ID = "app.example.com";
    const on = passkeyPlugins({ request: new Request("https://app.example.com/") });
    expect(on.map((plugin) => plugin.id)).toEqual(["passkey"]);
    const off = passkeyPlugins({
      request: new Request("https://ts-template.example.workers.dev/"),
    });
    expect(off).toEqual([]);
  });

  it("stays out of the auth module every session read loads", () => {
    // A static import in auth.ts would put the WebAuthn and X.509 libraries
    // back on the cold start of every page and server function.
    const source = readFileSync(join(import.meta.dirname, "auth.ts"), "utf8");
    expect(source).not.toMatch(/from "@better-auth\/passkey"|from "\.\/auth-passkey"/u);
  });
});
