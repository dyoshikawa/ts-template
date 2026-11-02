import { expect, signIn, test } from "./fixtures";

test("closes the account without a Turnstile widget", async ({ page, email }) => {
  await signIn({ page, email });
  await page.goto("/account");
  const closeButton = page.getByRole("button", { name: "アカウントを閉じてすべてのデータを削除" });
  await expect(closeButton).toBeDisabled();

  await page.getByRole("checkbox", { name: /すべてのデータが削除され/ }).check();
  // Turnstile is off (`TURNSTILE_DISABLED`), so no widget stands in the way.
  await expect(closeButton).toBeEnabled();
  await closeButton.click();

  await page.waitForURL("/");
  await expect(page.getByRole("link", { name: email })).toHaveCount(0);
});
