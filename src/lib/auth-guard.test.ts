import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  assertPasskeyOwnerAllowed,
  AUTHORITATIVE_SESSION_PATHS,
  DISABLED_AUTH_PATHS,
  guardAuthRequest,
  SEND_OTP_PATH,
  SIGN_IN_OTP_PATH,
  VERIFY_PASSKEY_REGISTRATION_PATH,
} from "./auth-guard";
import type { TurnstileConfig } from "./turnstile";

const vars = env as unknown as Record<string, string | undefined>;

const enabled: TurnstileConfig = { status: "enabled", siteKey: "0xSITE", secretKey: "0xSECRET" };

/** The HTTP status `guardAuthRequest` answers with, or `null` when it lets the request through. */
function statusOf(input: Parameters<typeof guardAuthRequest>[0]): number | null {
  try {
    guardAuthRequest(input);
    return null;
  } catch (error) {
    return (error as { statusCode: number }).statusCode;
  }
}

/** The status for registering a passkey with this request body. */
function register(body: unknown): number | null {
  return statusOf({ path: VERIFY_PASSKEY_REGISTRATION_PATH, body, turnstile: enabled });
}

/** Stands in for `console.error`, which the unconfigured case logs to. */
const logged = vi.fn();

beforeEach(() => {
  logged.mockClear();
  vi.spyOn(console, "error").mockImplementation(logged);
});

afterEach(() => {
  delete vars.ALLOWED_EMAILS;
  vi.restoreAllMocks();
});

describe("guardAuthRequest", () => {
  it("refuses a client-supplied passkey name", () => {
    expect(register({ response: {}, name: "Click https://evil.example" })).toBe(400);
    expect(register({ response: {}, name: "" })).toBe(400);
    expect(register({ response: {} })).toBeNull();
  });

  it("lets a sign-in code request through", () => {
    expect(
      statusOf({
        path: SEND_OTP_PATH,
        body: { email: "ann@example.com", type: "sign-in" },
        turnstile: enabled,
      }),
    ).toBeNull();
  });

  it("refuses codes of any other kind", () => {
    for (const type of ["email-verification", "forget-password", "change-email", undefined]) {
      expect(
        statusOf({
          path: SEND_OTP_PATH,
          body: { email: "ann@example.com", type },
          turnstile: enabled,
        }),
      ).toBe(400);
    }
  });

  it("sends no codes while Turnstile has no key pair", () => {
    expect(
      statusOf({
        path: SEND_OTP_PATH,
        body: { email: "ann@example.com", type: "sign-in" },
        turnstile: { status: "unconfigured" },
      }),
    ).toBe(503);
    expect(logged).toHaveBeenCalled();
  });

  it("keeps addresses outside the allowlist out of both sign-in steps", () => {
    vars.ALLOWED_EMAILS = "owner@example.com";
    const body = { email: "ann@example.com", type: "sign-in", otp: "123456" };
    expect(statusOf({ path: SEND_OTP_PATH, body, turnstile: enabled })).toBe(403);
    expect(statusOf({ path: "/sign-in/email-otp", body, turnstile: enabled })).toBe(403);
    expect(
      statusOf({
        path: "/sign-in/email-otp",
        body: { ...body, email: "Owner@Example.com" },
        turnstile: enabled,
      }),
    ).toBeNull();
  });

  it("lets a sign-in code request through while Turnstile is disabled locally", () => {
    expect(
      statusOf({
        path: SEND_OTP_PATH,
        body: { email: "ann@example.com", type: "sign-in" },
        turnstile: { status: "disabled" },
      }),
    ).toBeNull();
  });

  it("leaves other endpoints alone", () => {
    expect(
      statusOf({ path: "/get-session", body: undefined, turnstile: { status: "unconfigured" } }),
    ).toBeNull();
  });
});

describe("DISABLED_AUTH_PATHS", () => {
  it("switches off renaming passkeys but keeps adding, deleting and signing in", () => {
    expect(DISABLED_AUTH_PATHS).toContain("/passkey/update-passkey");
    for (const path of [
      "/passkey/generate-authenticate-options",
      "/passkey/verify-authentication",
      ...AUTHORITATIVE_SESSION_PATHS,
    ]) {
      expect(DISABLED_AUTH_PATHS).not.toContain(path);
    }
  });

  it("switches off Better Auth's unused password, verification and account endpoints", () => {
    for (const path of [
      "/verify-email",
      "/sign-in/email",
      "/sign-up/email",
      "/change-email",
      "/delete-user",
    ]) {
      expect(DISABLED_AUTH_PATHS).toContain(path);
    }
  });

  it("keeps the sign-in flow on", () => {
    for (const path of [SEND_OTP_PATH, SIGN_IN_OTP_PATH, "/sign-out", "/get-session"]) {
      expect(DISABLED_AUTH_PATHS).not.toContain(path);
    }
  });
});

/** The HTTP status the check answers with, or `null` when it lets the sign-in through. */
async function statusFor(email: string | null): Promise<number | null> {
  try {
    await assertPasskeyOwnerAllowed({
      credentialId: "cred-1",
      findOwnerEmail: async (id) => (id === "cred-1" ? email : null),
    });
    return null;
  } catch (error) {
    return (error as { statusCode: number }).statusCode;
  }
}

describe("assertPasskeyOwnerAllowed", () => {
  it("lets every passkey owner in when no list is configured", async () => {
    expect(await statusFor("anyone@example.com")).toBeNull();
  });

  it("refuses a passkey whose owner was removed from ALLOWED_EMAILS", async () => {
    vars.ALLOWED_EMAILS = "owner@example.com";
    expect(await statusFor("Owner@Example.com")).toBeNull();
    expect(await statusFor("removed@example.com")).toBe(403);
  });

  it("refuses a passkey without an account", async () => {
    expect(await statusFor(null)).toBe(403);
  });
});
