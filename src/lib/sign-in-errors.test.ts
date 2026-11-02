import { describe, expect, it } from "vite-plus/test";

import { en } from "../i18n/en";
import { ja } from "../i18n/ja";
import { EMAIL_NOT_ALLOWED, signInErrorMessage } from "./sign-in-errors";

describe("signInErrorMessage", () => {
  it("translates the server's codes rather than showing its text", () => {
    expect(
      signInErrorMessage({ error: { status: 403, code: EMAIL_NOT_ALLOWED }, step: "send", t: ja }),
    ).toBe(ja.login.errors.notAllowed);
    expect(
      signInErrorMessage({ error: { status: 400, code: "OTP_EXPIRED" }, step: "verify", t: en }),
    ).toBe(en.login.errors.expired);
    expect(
      signInErrorMessage({
        error: { status: 403, code: "TOO_MANY_ATTEMPTS" },
        step: "verify",
        t: en,
      }),
    ).toBe(en.login.errors.tooManyAttempts);
  });

  it("says to wait when rate-limited", () => {
    expect(signInErrorMessage({ error: { status: 429 }, step: "send", t: en })).toBe(
      en.login.errors.rateLimited,
    );
  });

  it("falls back to the step's general message", () => {
    expect(signInErrorMessage({ error: { status: 500 }, step: "send", t: ja })).toBe(
      ja.login.errors.sendFailed,
    );
    expect(signInErrorMessage({ error: { status: 500, code: "X" }, step: "verify", t: ja })).toBe(
      ja.login.errors.verifyFailed,
    );
  });
});
