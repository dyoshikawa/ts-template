import { describe, expect, it } from "vite-plus/test";

import {
  languageFromAcceptLanguage,
  languageFromCookie,
  requestLanguage,
  resolveLanguage,
} from "./language";

describe("languageFromAcceptLanguage", () => {
  it("reads any ja range as Japanese and anything else as English", () => {
    expect(languageFromAcceptLanguage("ja")).toBe("ja");
    expect(languageFromAcceptLanguage("ja-JP,ja;q=0.9,en;q=0.8")).toBe("ja");
    expect(languageFromAcceptLanguage("en-US,en;q=0.9")).toBe("en");
    expect(languageFromAcceptLanguage("fr-FR,ja;q=0.5")).toBe("en");
    expect(languageFromAcceptLanguage("japanese")).toBe("en");
  });

  it("follows the quality order", () => {
    expect(languageFromAcceptLanguage("en;q=0.4, ja;q=0.8")).toBe("ja");
    expect(languageFromAcceptLanguage("ja;q=0, en")).toBe("en");
  });

  it("falls back to Japanese with nothing to go on", () => {
    expect(languageFromAcceptLanguage(null)).toBe("ja");
    expect(languageFromAcceptLanguage("")).toBe("ja");
  });
});

describe("languageFromCookie", () => {
  it("finds the lang cookie among others", () => {
    expect(languageFromCookie("a=1; lang=en; b=2")).toBe("en");
    expect(languageFromCookie("lang=de")).toBeNull();
    expect(languageFromCookie("slang=en")).toBeNull();
    expect(languageFromCookie(null)).toBeNull();
  });

  it("ignores a malformed value instead of throwing", () => {
    expect(languageFromCookie("lang=%")).toBeNull();
    expect(languageFromCookie("lang=%E0%A4%A")).toBeNull();
    const request = new Request("https://app.example.com/", {
      headers: { cookie: "lang=%", "accept-language": "ja" },
    });
    expect(requestLanguage({ request })).toBe("ja");
  });
});

describe("resolveLanguage", () => {
  it("prefers the saved choice, then the cookie, then the browser", () => {
    expect(resolveLanguage({ saved: "en", cookieHeader: "lang=ja", acceptLanguage: "ja" })).toBe(
      "en",
    );
    expect(resolveLanguage({ saved: null, cookieHeader: "lang=en", acceptLanguage: "ja" })).toBe(
      "en",
    );
    expect(resolveLanguage({ saved: null, cookieHeader: null, acceptLanguage: "en-GB" })).toBe(
      "en",
    );
  });
});
