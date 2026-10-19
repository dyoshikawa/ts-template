import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { guardAuthRequest, SEND_OTP_PATH } from "./auth-guard";
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

  it("leaves other endpoints alone", () => {
    expect(
      statusOf({ path: "/get-session", body: undefined, turnstile: { status: "unconfigured" } }),
    ).toBeNull();
  });
});
