import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const setCookie = vi.fn();
vi.mock("@tanstack/react-start/server", () => ({ setCookie }));

const { setLanguageCookie } = await import("./language-cookie");

beforeEach(() => {
  setCookie.mockClear();
});

describe("setLanguageCookie", () => {
  it("keeps the choice site-wide for a year, Secure on https", () => {
    setLanguageCookie({ request: new Request("https://app.example.com/account"), language: "en" });
    expect(setCookie).toHaveBeenCalledWith("lang", "en", {
      path: "/",
      maxAge: 365 * 24 * 60 * 60,
      sameSite: "lax",
      secure: true,
    });
  });

  it("leaves Secure off on a plain http local run", () => {
    setLanguageCookie({ request: new Request("http://localhost:4173/"), language: "ja" });
    expect(setCookie).toHaveBeenCalledWith(
      "lang",
      "ja",
      expect.objectContaining({ secure: false }),
    );
  });
});
