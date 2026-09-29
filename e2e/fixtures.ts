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

export const test = base.extend<{ email: string; cspGuard: void }>({
  /** A fresh address per test, so tests never see each other's data. */
  // oxlint-disable-next-line no-empty-pattern -- Playwright's fixture signature
  email: async ({}, use, testInfo) => {
    await use(`e2e-${testInfo.testId}-${Date.now()}@example.com`);
  },
  /**
   * Fails any test during which the browser blocked something under the
   * Content-Security-Policy, so a script, style or frame the policy forgot
   * shows up here rather than as a broken page in production.
   */
  cspGuard: [
    async ({ page }, use) => {
      const violations: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "error" && /Content Security Policy/iu.test(message.text())) {
          violations.push(message.text());
        }
      });
      await use();
      expect(violations).toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
