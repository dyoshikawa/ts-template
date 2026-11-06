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

test("a close that fails says why and can be tried again", async ({ page, email }) => {
  await signIn({ page, email });
  await page.goto("/account");
  let failing = true;
  await page.route("**/_serverFn/**", async (route) => {
    if (failing && route.request().method() === "POST") {
      await route.fulfill({ status: 500, contentType: "text/plain", body: "boom" });
    } else {
      await route.continue();
    }
  });
  await page.getByRole("checkbox", { name: /すべてのデータが削除され/ }).check();
  const closeButton = page.getByRole("button", { name: "アカウントを閉じてすべてのデータを削除" });
  await closeButton.click();
  await expect(page.getByRole("alert")).toHaveText(
    /^アカウントを閉じられませんでした。サーバーでエラーが起きました/u,
  );
  // The spent Turnstile token is replaced by a fresh challenge, so the
  // button does not stay disabled for good.
  await expect(closeButton).toBeEnabled();

  failing = false;
  await closeButton.click();
  await page.waitForURL("/");
  await expect(page.getByRole("link", { name: email })).toHaveCount(0);
});
