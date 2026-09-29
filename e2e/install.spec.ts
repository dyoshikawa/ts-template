import { devices } from "@playwright/test";

import { expect, test } from "./fixtures";

test("an iPhone gets the Add to Home Screen guide", async ({ page }) => {
  // The project's device is an iPhone, so the iOS way is shown.
  await page.goto("/");
  await page.getByRole("button", { name: "📲 Add to Home Screen" }).click();
  const guide = page.getByRole("dialog", { name: "How to add to your Home Screen" });
  await expect(guide).toBeVisible();
  await expect(
    guide.getByText("Scroll down the sheet and tap “Add to Home Screen”."),
  ).toBeVisible();
  await guide.getByRole("button", { name: "Close" }).click();
  await expect(guide).toBeHidden();
});

test.describe("on a desktop browser", () => {
  const { defaultBrowserType: _browser, ...desktop } = devices["Desktop Chrome"];
  test.use(desktop);

  test("offers nothing until the browser does, then fires its dialog", async ({ page }) => {
    await page.goto("/");
    const install = page.getByRole("button", { name: "📲 Install app" });
    await expect(page.getByRole("heading", { name: "ts-template" })).toBeVisible();
    await expect(install).toHaveCount(0);

    // Headless Chromium never makes the offer itself: stand one in.
    await page.evaluate(() => {
      const offer = new Event("beforeinstallprompt", { cancelable: true });
      Object.assign(offer, {
        prompt: async () => {
          Object.assign(globalThis, { installPrompted: true });
        },
        userChoice: Promise.resolve({ outcome: "accepted" }),
      });
      globalThis.dispatchEvent(offer);
    });
    await install.click();
    await expect.poll(() => page.evaluate(() => "installPrompted" in globalThis)).toBe(true);
    // Accepted: the app counts as installed and the button goes away.
    await expect(install).toHaveCount(0);
  });
});
