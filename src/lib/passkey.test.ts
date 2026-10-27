import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { passkeyConfig } from "./passkey";

/** The stand-in `env` as a bag of variables. */
const vars = env as unknown as Record<string, string | undefined>;

beforeEach(() => {
  vi.stubEnv("DEV", false);
  vars.PASSKEY_RP_ID = "app.example.com";
});

afterEach(() => {
  delete vars.PASSKEY_RP_ID;
  vi.unstubAllEnvs();
});

describe("passkeyConfig", () => {
  it("offers passkeys on the configured domain, bound to it", () => {
    const request = new Request("https://app.example.com/login");
    expect(passkeyConfig({ request })).toEqual({
      status: "enabled",
      rpID: "app.example.com",
      origin: ["https://app.example.com"],
    });
  });

  it("offers none on the workers.dev host or any other host", () => {
    for (const url of [
      "https://my-app.example.workers.dev/login",
      "https://evil.example/login",
      "https://sub.app.example.com/login",
    ]) {
      expect(passkeyConfig({ request: new Request(url) })).toEqual({ status: "disabled" });
    }
  });

  it("offers none without a configured RP ID", () => {
    for (const value of [undefined, "", "  "]) {
      vars.PASSKEY_RP_ID = value;
      const request = new Request("https://app.example.com/login");
      expect(passkeyConfig({ request })).toEqual({ status: "disabled" });
    }
  });

  it("uses localhost for local runs, even when the emulator rewrites the URL", () => {
    const rewritten = new Request("https://app.example.com/login", {
      headers: { "CF-Connecting-IP": "127.0.0.1" },
    });
    for (const request of [new Request("http://localhost:4173/login"), rewritten]) {
      expect(passkeyConfig({ request })).toEqual({
        status: "enabled",
        rpID: "localhost",
        origin: ["http://localhost:4173", "http://localhost:5173"],
      });
    }
  });
});
