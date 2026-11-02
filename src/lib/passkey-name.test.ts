import { describe, expect, it } from "vite-plus/test";

import { passkeyLabel, passkeyName } from "./passkey-name";

const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const ANDROID_CHROME =
  "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36";
const WINDOWS_EDGE =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0";
const IPHONE_CHROME =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/140.0.0.0 Mobile/15E148 Safari/604.1";

describe("passkeyName", () => {
  it("names the device and browser when the authenticator is unknown", () => {
    expect(passkeyName({ provider: undefined, userAgent: IPHONE_SAFARI })).toBe("Safari · iPhone");
    expect(passkeyName({ provider: undefined, userAgent: WINDOWS_EDGE })).toBe("Edge · Windows");
    expect(passkeyName({ provider: undefined, userAgent: IPHONE_CHROME })).toBe("Chrome · iPhone");
  });

  it("puts a known password manager first", () => {
    expect(passkeyName({ provider: "Google Password Manager", userAgent: ANDROID_CHROME })).toBe(
      "Google Password Manager (Chrome · Android)",
    );
    expect(passkeyName({ provider: "1Password", userAgent: null })).toBe("1Password");
  });

  it("falls back to a plain label", () => {
    expect(passkeyName({ provider: undefined, userAgent: "curl/8.0" })).toBe("Passkey");
    expect(passkeyName({ provider: undefined, userAgent: null })).toBe("Passkey");
  });

  it("caps the length", () => {
    expect(passkeyName({ provider: "x".repeat(300), userAgent: null })).toHaveLength(100);
  });
});

describe("passkeyLabel", () => {
  it("shows the stored name, or the page's own word for a passkey without one", () => {
    expect(passkeyLabel({ name: "Safari · iPhone", unnamed: "パスキー" })).toBe("Safari · iPhone");
    expect(passkeyLabel({ name: null, unnamed: "パスキー" })).toBe("パスキー");
    expect(passkeyLabel({ name: "Passkey", unnamed: "パスキー" })).toBe("パスキー");
  });
});
