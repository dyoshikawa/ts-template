import { expect, test as base, type Page } from "@playwright/test";

/** The code every sign-in accepts under `.dev.vars.e2e` (`E2E_SIGN_IN_CODE`). */
export const SIGN_IN_CODE = "123456";

/** Signs in as `email` (registered on the spot) and waits for the home page. */
export async function signIn({ page, email }: { page: Page; email: string }): Promise<void> {
  await page.goto("/login");
  await page.getByRole("textbox", { name: "Email address" }).fill(email);
  await page.getByRole("button", { name: "Send code" }).click();
  await page.getByRole("textbox", { name: "Sign-in code" }).fill(SIGN_IN_CODE);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("/");
  await expect(page.getByRole("link", { name: email })).toBeVisible();
}

/** A fresh address per test, so tests never see each other's data. */
export const test = base.extend<{ email: string }>({
  // oxlint-disable-next-line no-empty-pattern -- Playwright's fixture signature
  email: async ({}, use, testInfo) => {
    await use(`e2e-${testInfo.testId}-${Date.now()}@example.com`);
  },
});

export { expect };
