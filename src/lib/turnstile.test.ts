import { env } from "cloudflare:workers";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  turnstileDisabled,
  turnstileSecretKey,
  turnstileSiteKey,
  verifyTurnstile,
} from "./turnstile";

/** The stand-in `env` as a bag of variables; `TURNSTILE_SITE_KEY` is typed as always set. */
const vars = env as unknown as Record<string, string | undefined>;

const local = new Request("http://localhost:4173/login");
const deployed = new Request("https://app.example.com/login");

afterEach(() => {
  for (const key of Object.keys(vars)) {
    delete vars[key];
  }
  vi.unstubAllGlobals();
});

describe("turnstile keys", () => {
  it("falls back to Cloudflare's test keys when none are configured", () => {
    expect(turnstileSiteKey({ request: deployed })).toBe("1x00000000000000000000AA");
    expect(turnstileSecretKey()).toBe("1x0000000000000000000000000000000AA");
  });

  it("uses the configured pair", () => {
    vars.TURNSTILE_SITE_KEY = "0xSITE";
    vars.TURNSTILE_SECRET_KEY = "0xSECRET";
    expect(turnstileSiteKey({ request: deployed })).toBe("0xSITE");
    expect(turnstileSecretKey()).toBe("0xSECRET");
  });

  it("hands out no site key while disabled, but only to a local address", () => {
    vars.TURNSTILE_SITE_KEY = "0xSITE";
    vars.TURNSTILE_DISABLED = "1";
    expect(turnstileDisabled({ request: local })).toBe(true);
    expect(turnstileSiteKey({ request: local })).toBe("");
    // Set on the deployed Worker by mistake, the switch changes nothing.
    expect(turnstileDisabled({ request: deployed })).toBe(false);
    expect(turnstileSiteKey({ request: deployed })).toBe("0xSITE");
    vars.TURNSTILE_DISABLED = "0";
    expect(turnstileDisabled({ request: local })).toBe(false);
    expect(turnstileSiteKey({ request: local })).toBe("0xSITE");
  });
});

describe("verifyTurnstile", () => {
  it("asks Cloudflare with the secret, the token and the caller's address", async () => {
    vars.TURNSTILE_SECRET_KEY = "0xSECRET";
    const fetchMock = vi.fn(async () => Response.json({ success: true }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      verifyTurnstile({ request: deployed, token: "tok", remoteIp: "203.0.113.5" }),
    ).resolves.toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
    expect(Object.fromEntries(init.body as URLSearchParams)).toEqual({
      secret: "0xSECRET",
      response: "tok",
      remoteip: "203.0.113.5",
    });
  });

  it("fails closed on a rejected token or a failed request", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ success: false })),
    );
    await expect(
      verifyTurnstile({ request: deployed, token: "tok", remoteIp: null }),
    ).resolves.toBe(false);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 500 })),
    );
    await expect(
      verifyTurnstile({ request: deployed, token: "tok", remoteIp: null }),
    ).resolves.toBe(false);
  });

  it("verifies anything while disabled locally, without calling Cloudflare", async () => {
    vars.TURNSTILE_DISABLED = "true";
    const fetchMock = vi.fn(async () => Response.json({ success: false }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      verifyTurnstile({ request: local, token: "whatever", remoteIp: null }),
    ).resolves.toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
    // Deployed, the same switch still verifies with Cloudflare.
    await expect(
      verifyTurnstile({ request: deployed, token: "whatever", remoteIp: null }),
    ).resolves.toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
