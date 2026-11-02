import { describe, expect, it } from "vite-plus/test";

import { buildPasskeyAddedEmail } from "./passkey-email";

describe("buildPasskeyAddedEmail", () => {
  it("names the passkey and links to the account page", () => {
    const email = buildPasskeyAddedEmail({
      appName: "my-app",
      passkeyName: "Safari · iPhone",
      accountUrl: "https://app.example.com/account",
      language: "en",
    });

    expect(email.subject).toBe("A passkey was added to your my-app account");
    expect(email.text).toContain('"Safari · iPhone"');
    expect(email.text).toContain("https://app.example.com/account");
    expect(email.html).toContain('href="https://app.example.com/account"');
  });

  it("speaks Japanese to a Japanese account", () => {
    const email = buildPasskeyAddedEmail({
      appName: "my-app",
      passkeyName: "Safari · iPhone",
      accountUrl: "https://app.example.com/account",
      language: "ja",
    });

    expect(email.subject).toBe("my-app のアカウントにパスキーが追加されました");
    expect(email.text).toContain("「Safari · iPhone」");
    expect(email.html).toContain('href="https://app.example.com/account"');
  });

  it("escapes HTML in the passkey name", () => {
    const email = buildPasskeyAddedEmail({
      appName: "my-app",
      passkeyName: "<b>x</b>",
      accountUrl: "https://example.com/account",
      language: "en",
    });

    expect(email.html).not.toContain("<b>");
    expect(email.html).toContain("&lt;b&gt;x&lt;/b&gt;");
  });
});
