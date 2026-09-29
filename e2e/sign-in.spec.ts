import { expect, signIn, test } from "./fixtures";

test("signs in with the fixed code and lands on the home page", async ({ page, email }) => {
  await signIn({ page, email });
  await expect(page.getByText(`Signed in as ${email}`)).toBeVisible();
});

test("signs out from the menu and back in to the same account", async ({ page, email }) => {
  await signIn({ page, email });
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.getByRole("link", { name: email })).toHaveCount(0);
  await signIn({ page, email });
});

test("the account page asks a signed-out visitor to sign in", async ({ page }) => {
  await page.goto("/account");
  await page.waitForURL("/login");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("the code step asks no second challenge and offers no resend", async ({ page, email }) => {
  await page.goto("/login");
  await page.getByRole("textbox", { name: "Email address" }).fill(email);
  await page.getByRole("button", { name: "Send code" }).click();
  await expect(page.getByRole("textbox", { name: "Sign-in code" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Resend code" })).toHaveCount(0);

  // A new code is had by going back to the email step.
  await page.getByRole("button", { name: "Back to the email step" }).click();
  await expect(page.getByRole("textbox", { name: "Email address" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Send code" })).toBeVisible();
});
