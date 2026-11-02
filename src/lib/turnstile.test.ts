import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import {
  turnstileBinding,
  turnstileClientConfig,
  turnstileConfig,
  verifyTurnstile,
} from "./turnstile";

/** The stand-in `env` as a bag of variables; `TURNSTILE_SITE_KEY` is typed as always set. */
const vars = env as unknown as Record<string, string | undefined>;

const local = new Request("http://localhost:4173/login");
const deployed = new Request("https://app.example.com/login");

const TEST_KEYS = {
  status: "enabled",
  siteKey: "1x00000000000000000000AA",
  secretKey: "1x0000000000000000000000000000000AA",
};

/** Stands in for `console.error`, which the unconfigured case logs to. */
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
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("turnstileConfig", () => {
  it("falls back to Cloudflare's test keys on a local address", () => {
    expect(turnstileConfig({ request: local })).toEqual(TEST_KEYS);
    vars.TURNSTILE_SITE_KEY = "0xSITE";
    expect(turnstileConfig({ request: local })).toEqual({ ...TEST_KEYS, siteKey: "0xSITE" });
  });

  it("falls back to the test keys under `vp dev`", () => {
    vi.stubEnv("DEV", true);
    expect(turnstileConfig({ request: deployed })).toEqual(TEST_KEYS);
  });

  it("is unconfigured on a deployed Worker without a full key pair", () => {
    expect(turnstileConfig({ request: deployed })).toEqual({ status: "unconfigured" });
    vars.TURNSTILE_SITE_KEY = "0xSITE";
    expect(turnstileConfig({ request: deployed })).toEqual({ status: "unconfigured" });
    delete vars.TURNSTILE_SITE_KEY;
    vars.TURNSTILE_SECRET_KEY = "0xSECRET";
    expect(turnstileConfig({ request: deployed })).toEqual({ status: "unconfigured" });
  });

  it("uses the configured pair", () => {
    vars.TURNSTILE_SITE_KEY = "0xSITE";
    vars.TURNSTILE_SECRET_KEY = "0xSECRET";
    expect(turnstileConfig({ request: deployed })).toEqual({
      status: "enabled",
      siteKey: "0xSITE",
      secretKey: "0xSECRET",
    });
  });

  it("is disabled by the switch, but only for a local address", () => {
    vars.TURNSTILE_SITE_KEY = "0xSITE";
    vars.TURNSTILE_SECRET_KEY = "0xSECRET";
    vars.TURNSTILE_DISABLED = "1";
    expect(turnstileConfig({ request: local })).toEqual({ status: "disabled" });
    // Set on the deployed Worker by mistake, the switch changes nothing.
    expect(turnstileConfig({ request: deployed }).status).toBe("enabled");
    vars.TURNSTILE_DISABLED = "0";
    expect(turnstileConfig({ request: local }).status).toBe("enabled");
  });
});

describe("turnstileClientConfig", () => {
  it("never hands out the secret", () => {
    vars.TURNSTILE_SITE_KEY = "0xSITE";
    vars.TURNSTILE_SECRET_KEY = "0xSECRET";
    expect(turnstileClientConfig({ request: deployed })).toEqual({
      status: "enabled",
      siteKey: "0xSITE",
    });
    delete vars.TURNSTILE_SECRET_KEY;
    expect(turnstileClientConfig({ request: deployed })).toEqual({ status: "unconfigured" });
  });
});

describe("verifyTurnstile", () => {
  it("asks Cloudflare with the secret, the token and the caller's address", async () => {
    vars.TURNSTILE_SITE_KEY = "0xSITE";
    vars.TURNSTILE_SECRET_KEY = "0xSECRET";
    const fetchMock = vi.fn(async () =>
      Response.json({ success: true, hostname: "app.example.com", action: "sign-in" }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      verifyTurnstile({
        request: deployed,
        token: "tok",
        remoteIp: "203.0.113.5",
        action: "sign-in",
      }),
    ).resolves.toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
    expect(Object.fromEntries(init.body as URLSearchParams)).toEqual({
      secret: "0xSECRET",
      response: "tok",
      remoteip: "203.0.113.5",
    });
  });

  it("refuses every token on a deployed Worker without a key pair, without calling Cloudflare", async () => {
    const fetchMock = vi.fn(async () => Response.json({ success: true }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      verifyTurnstile({ request: deployed, token: "tok", remoteIp: null, action: "sign-in" }),
    ).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(logged).toHaveBeenCalled();
  });

  it("fails closed on a rejected token or a failed request", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ success: false })),
    );
    await expect(
      verifyTurnstile({ request: local, token: "tok", remoteIp: null, action: "sign-in" }),
    ).resolves.toBe(false);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 500 })),
    );
    await expect(
      verifyTurnstile({ request: local, token: "tok", remoteIp: null, action: "sign-in" }),
    ).resolves.toBe(false);
  });

  it("verifies anything while disabled locally, without calling Cloudflare", async () => {
    vars.TURNSTILE_SITE_KEY = "0xSITE";
    vars.TURNSTILE_SECRET_KEY = "0xSECRET";
    vars.TURNSTILE_DISABLED = "true";
    const fetchMock = vi.fn(async () => Response.json({ success: false }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      verifyTurnstile({ request: local, token: "whatever", remoteIp: null, action: "sign-in" }),
    ).resolves.toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
    // Deployed, the same switch still verifies with Cloudflare.
    await expect(
      verifyTurnstile({ request: deployed, token: "whatever", remoteIp: null, action: "sign-in" }),
    ).resolves.toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("turnstileBinding", () => {
  it("binds tokens to the deployed hostname, and not on local runs", () => {
    expect(turnstileBinding({ request: deployed })).toEqual({
      hostname: "app.example.com",
    });
    expect(turnstileBinding({ request: local })).toBeNull();
    vi.stubEnv("DEV", true);
    expect(turnstileBinding({ request: deployed })).toBeNull();
  });
});

/** Makes Cloudflare's token check pass the token and report `result` with it. */
function answer(result: object): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ success: true, ...result })),
  );
}

/** Verifies a token for the account-deletion form on the deployed Worker. */
function verify(): Promise<boolean> {
  return verifyTurnstile({
    request: deployed,
    token: "tok",
    remoteIp: null,
    action: "delete-account",
  });
}

describe("verifyTurnstile binding", () => {
  it("refuses a token solved for another action or on another hostname", async () => {
    vars.TURNSTILE_SITE_KEY = "0xSITE";
    vars.TURNSTILE_SECRET_KEY = "0xSECRET";
    answer({ hostname: "app.example.com", action: "delete-account" });
    await expect(verify()).resolves.toBe(true);
    answer({ hostname: "app.example.com", action: "sign-in" });
    await expect(verify()).resolves.toBe(false);
    answer({ hostname: "evil.example", action: "delete-account" });
    await expect(verify()).resolves.toBe(false);
    answer({});
    await expect(verify()).resolves.toBe(false);
  });

  it("checks neither on a local run, where the test keys report none", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ success: true })),
    );
    await expect(
      verifyTurnstile({ request: local, token: "tok", remoteIp: null, action: "delete-account" }),
    ).resolves.toBe(true);
  });
});
