import { describe, expect, it } from "vite-plus/test";

import { hasSessionCookie } from "./session-cookie";

describe("hasSessionCookie", () => {
  it("finds the session token under each of Better Auth's cookie names", () => {
    expect(hasSessionCookie("better-auth.session_token=abc.def")).toBe(true);
    expect(hasSessionCookie("lang=ja; __Host-better-auth.session_token=abc.def")).toBe(true);
    expect(hasSessionCookie("__Secure-better-auth.session_token=abc; other=1")).toBe(true);
  });

  it("is false without a session token cookie", () => {
    expect(hasSessionCookie(null)).toBe(false);
    expect(hasSessionCookie("")).toBe(false);
    expect(hasSessionCookie("lang=ja")).toBe(false);
    // The cookie cache alone is no session: Better Auth answers null for it.
    expect(hasSessionCookie("better-auth.session_data=xyz")).toBe(false);
    // A value that merely mentions the name is not the cookie.
    expect(hasSessionCookie("note=session_token")).toBe(false);
  });
});
