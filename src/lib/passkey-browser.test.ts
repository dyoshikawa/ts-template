import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { en } from "../i18n/en";
import { APP_NAME } from "./app";
import {
  declinePasskeyOffer,
  endPasskeyOffer,
  passkeyRegistrationErrorMessage,
  passkeySignInErrorMessage,
  requestPasskeyOffer,
  showPasskeyOffer,
  usePasskeyOfferPending,
} from "./passkey-browser";
import { UNREACHABLE } from "./unreachable";

const OFFER_KEY = `${APP_NAME}:passkey-offer`;
const DECLINED_KEY = `${APP_NAME}:passkey-offer-declined`;

afterEach(() => {
  vi.unstubAllGlobals();
  window.sessionStorage.clear();
  window.localStorage.clear();
});

describe("passkey error messages", () => {
  const locale = "en-US";

  it("stays quiet when the user closed the browser's dialog", () => {
    for (const code of ["ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY", "ERROR_CEREMONY_ABORTED"]) {
      const error = { status: 400, code };
      expect(passkeyRegistrationErrorMessage({ error, t: en, locale })).toBeNull();
      expect(passkeySignInErrorMessage({ error, t: en, locale })).toBeNull();
    }
  });

  it("asks for a fresh email sign-in when the session is too old to add a passkey", () => {
    expect(
      passkeyRegistrationErrorMessage({
        error: { status: 403, code: "SESSION_NOT_FRESH" },
        t: en,
        locale,
      }),
    ).toContain("sign in again with your email address");
  });

  it("says the account is full when it holds the most passkeys it may", () => {
    expect(
      passkeyRegistrationErrorMessage({
        error: { status: 403, code: "TOO_MANY_PASSKEYS" },
        t: en,
        locale,
      }),
    ).toBe(en.passkeys.errors.tooMany);
  });

  it("points to email sign-in when a passkey fails, and says what kind of failure it was", () => {
    expect(
      passkeySignInErrorMessage({
        error: { status: 401, code: "PASSKEY_NOT_FOUND" },
        t: en,
        locale,
      }),
    ).toContain("Sign in with your email address");
    expect(passkeySignInErrorMessage({ error: { status: 500 }, t: en, locale })).toBe(
      `${en.passkeys.errors.signInFailed} ${en.failure.server({ status: 500 })} ${en.passkeys.errors.emailInstead}`,
    );
    expect(
      passkeySignInErrorMessage({ error: { status: 503, code: UNREACHABLE }, t: en, locale }),
    ).toContain(en.failure.offline);
  });

  it("names the browser's refusal rather than calling it the server's", () => {
    expect(
      passkeyRegistrationErrorMessage({
        error: { status: 400, code: "ERROR_INVALID_DOMAIN" },
        t: en,
        locale,
      }),
    ).toBe(
      `${en.passkeys.errors.addFailed} ${en.passkeys.errors.browser({ code: "ERROR_INVALID_DOMAIN" })}`,
    );
  });

  it("says so when the account may not sign in", () => {
    expect(
      passkeySignInErrorMessage({ error: { status: 403, code: "FORBIDDEN" }, t: en, locale }),
    ).toBe("This account cannot sign in.");
  });
});

describe("the passkey offer", () => {
  it("is requested by an email sign-in and ended once answered", () => {
    requestPasskeyOffer();
    expect(window.sessionStorage.getItem(OFFER_KEY)).toBe("1");
    endPasskeyOffer();
    expect(window.sessionStorage.getItem(OFFER_KEY)).toBeNull();
  });

  it("is used up once on screen, so a reload does not show it again", () => {
    // jsdom has no WebAuthn; the offer is only shown where it works.
    vi.stubGlobal("PublicKeyCredential", function PublicKeyCredential() {});
    requestPasskeyOffer();
    const end = showPasskeyOffer();
    expect(window.sessionStorage.getItem(OFFER_KEY)).toBeNull();
    end();
  });

  it("survives a StrictMode remount and ends once the page is left", () => {
    vi.useFakeTimers();
    vi.stubGlobal("PublicKeyCredential", function PublicKeyCredential() {});
    requestPasskeyOffer();
    const { result } = renderHook(() => usePasskeyOfferPending());
    // Development mounts, unmounts and mounts again.
    act(() => {
      showPasskeyOffer()();
    });
    const end = showPasskeyOffer();
    act(() => {
      vi.runAllTimers();
    });
    expect(result.current).toBe(true);
    act(() => {
      end();
      vi.runAllTimers();
    });
    expect(result.current).toBe(false);
    vi.useRealTimers();
  });

  it("is declined on this device for good", () => {
    requestPasskeyOffer();
    declinePasskeyOffer();
    expect(window.sessionStorage.getItem(OFFER_KEY)).toBeNull();
    expect(window.localStorage.getItem(DECLINED_KEY)).toBe("1");
  });
});
