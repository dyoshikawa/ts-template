import { describe, expect, it } from "vite-plus/test";

import { en } from "../i18n/en";
import { ja } from "../i18n/ja";
import { EMAIL_NOT_ALLOWED, signInErrorMessage } from "./sign-in-errors";
import { UNREACHABLE } from "./unreachable";

describe("signInErrorMessage", () => {
  it("translates the server's codes rather than showing its text", () => {
    expect(
      signInErrorMessage({
        error: { status: 403, code: EMAIL_NOT_ALLOWED },
        step: "send",
        t: ja,
        locale: "ja-JP",
      }),
    ).toBe(ja.login.errors.notAllowed);
    expect(
      signInErrorMessage({
        error: { status: 400, code: "OTP_EXPIRED" },
        step: "verify",
        t: en,
        locale: "en-US",
      }),
    ).toBe(en.login.errors.expired);
    expect(
      signInErrorMessage({
        error: { status: 403, code: "TOO_MANY_ATTEMPTS" },
        step: "verify",
        t: en,
        locale: "en-US",
      }),
    ).toBe(en.login.errors.tooManyAttempts);
  });

  it("says to wait when rate-limited, until when the server says", () => {
    expect(
      signInErrorMessage({ error: { status: 429 }, step: "send", t: en, locale: "en-US" }),
    ).toBe(en.failure.rateLimited);
    expect(
      signInErrorMessage({
        error: { status: 429, retryAfter: 60 },
        step: "send",
        t: en,
        locale: "en-US",
      }),
    ).toMatch(/^Too many tries in a short time\. Try again after .+\.$/u);
  });

  it("follows the step's own sentence with the kind of failure", () => {
    expect(
      signInErrorMessage({
        error: { status: 503, code: UNREACHABLE },
        step: "send",
        t: ja,
        locale: "ja-JP",
      }),
    ).toBe(`${ja.login.errors.sendFailed}${ja.failure.offline}`);
    expect(
      signInErrorMessage({
        error: { status: 500, code: "X" },
        step: "verify",
        t: en,
        locale: "en-US",
      }),
    ).toBe(`${en.login.errors.verifyRequestFailed} ${en.failure.server({ status: 500 })}`);
  });

  it("keeps a wrong code apart from a failed check", () => {
    expect(
      signInErrorMessage({
        error: { status: 400, code: "INVALID_OTP" },
        step: "verify",
        t: ja,
        locale: "ja-JP",
      }),
    ).toBe(ja.login.errors.verifyFailed);
  });
});
