import { describe, expect, it } from "vite-plus/test";

import { buildOtpEmail } from "./otp-email";

describe("buildOtpEmail", () => {
  it("puts the code in the subject and both bodies", () => {
    const email = buildOtpEmail({
      appName: "ts-template",
      otp: "12345678",
      expiresInMinutes: 10,
      language: "en",
    });

    expect(email.subject).toBe("1234-5678 is your ts-template sign-in code");
    expect(email.text).toContain("1234-5678");
    expect(email.text).toContain("expires in 10 minutes");
    expect(email.html).toContain("1234-5678");
  });

  it("speaks Japanese for a Japanese page, still with the hyphenated code", () => {
    const email = buildOtpEmail({
      appName: "ts-template",
      otp: "12345678",
      expiresInMinutes: 10,
      language: "ja",
    });

    expect(email.subject).toBe("ts-template のサインインコードは 1234-5678 です");
    expect(email.text).toContain("有効期限は 10 分");
    expect(email.html).toContain("1234-5678");
  });

  it("escapes HTML in the app name", () => {
    const email = buildOtpEmail({
      appName: "<b>x</b>",
      otp: "00000000",
      expiresInMinutes: 5,
      language: "en",
    });

    expect(email.html).not.toContain("<b>");
    expect(email.html).toContain("&lt;b&gt;x&lt;/b&gt;");
  });
});
