import { expect, signIn, test } from "./fixtures";

test("signs in with the fixed code and lands on the home page", async ({ page, email }) => {
  await signIn({ page, email });
  await expect(page.getByText(`${email} でサインインしています`)).toBeVisible();
});

test("signs out from the menu and back in to the same account", async ({ page, email }) => {
  await signIn({ page, email });
  await page.getByRole("button", { name: "メニュー", exact: true }).click();
  await page.getByRole("button", { name: "サインアウト", exact: true }).click();
  await expect(page.getByRole("link", { name: email })).toHaveCount(0);
  await signIn({ page, email });
});

test("the account page asks a signed-out visitor to sign in", async ({ page }) => {
  await page.goto("/account");
  await page.waitForURL("/login");
  await expect(page.getByRole("heading", { name: "サインイン" })).toBeVisible();
});

test("the code step offers no resend", async ({ page, email }) => {
  await page.goto("/login");
  await page.getByRole("textbox", { name: "メールアドレス" }).fill(email);
  await page.getByRole("button", { name: "コードを送信" }).click();
  await expect(page.getByRole("textbox", { name: "サインインコード" })).toBeVisible();
  await expect(page.getByRole("button", { name: "コードを再送" })).toHaveCount(0);

  // The code is typed without its hyphen and shown with it.
  const code = page.getByRole("textbox", { name: "サインインコード" });
  await code.pressSequentially("12345678");
  await expect(code).toHaveValue("1234-5678");

  // A new code is had by going back to the email step.
  await page.getByRole("button", { name: "メールアドレスの入力に戻る" }).click();
  await expect(page.getByRole("textbox", { name: "メールアドレス" })).toBeVisible();
  await expect(page.getByRole("button", { name: "コードを送信" })).toBeVisible();
});

test("the email OTP endpoints outside the sign-in flow are switched off", async ({ request }) => {
  for (const path of [
    "/api/auth/email-otp/request-password-reset",
    "/api/auth/forget-password/email-otp",
    "/api/auth/email-otp/reset-password",
    "/api/auth/email-otp/check-verification-otp",
    "/api/auth/email-otp/verify-email",
    "/api/auth/email-otp/request-email-change",
    "/api/auth/email-otp/change-email",
  ]) {
    const response = await request.post(path, {
      data: { email: "someone@example.com", otp: "12345678", password: "password1234" },
    });
    expect(response.status(), path).toBe(404);
  }
});

test("Better Auth's own endpoints the app does not use are switched off", async ({ request }) => {
  for (const path of [
    "/api/auth/sign-in/email",
    "/api/auth/sign-up/email",
    "/api/auth/sign-in/social",
    "/api/auth/request-password-reset",
    "/api/auth/reset-password",
    "/api/auth/send-verification-email",
    "/api/auth/change-email",
    "/api/auth/change-password",
    "/api/auth/delete-user",
  ]) {
    const response = await request.post(path, {
      data: { email: "someone@example.com", password: "password1234", provider: "github" },
    });
    expect(response.status(), path).toBe(404);
  }
  for (const path of ["/api/auth/verify-email?token=x", "/api/auth/delete-user/callback?token=x"]) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status(), path).toBe(404);
  }
});

test("only sign-in codes can be requested", async ({ request }) => {
  const response = await request.post("/api/auth/email-otp/send-verification-otp", {
    data: { email: "someone@example.com", type: "forget-password" },
  });
  expect(response.status()).toBe(400);
  expect(((await response.json()) as { message?: string }).message).toContain("Only sign-in codes");
});
