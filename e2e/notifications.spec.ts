import { expect, signIn, test } from "./fixtures";

// The service worker is what receives pushes, so it must run here.
test.use({ serviceWorkers: "allow" });

/**
 * Headless Chromium cannot reach a real push service and reports the
 * notification permission as denied whatever is granted, so both are stood
 * in: the permission reads granted, `subscribe` hands out a fixed
 * FCM-looking endpoint and `unsubscribe` forgets it. The service worker, the
 * server functions and the database are real.
 */
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Notification, "permission", { get: () => "granted" });
    Object.assign(Notification, { requestPermission: async () => "granted" });
    let current: object | null = null;
    const fake = {
      endpoint: `https://fcm.googleapis.com/fcm/send/e2e-${Date.now()}`,
      toJSON() {
        return {
          endpoint: this.endpoint,
          keys: {
            p256dh:
              "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
            auth: "BTBZMqHH6r4Tts7J_aSIgg",
          },
        };
      },
      unsubscribe: async () => {
        current = null;
        return true;
      },
    };
    Object.assign(PushManager.prototype, {
      subscribe: async () => {
        current = fake;
        return fake;
      },
      getSubscription: async () => current,
    });
  });
});

test("turns notifications on and off from the account page", async ({ page, email }) => {
  await signIn({ page, email });
  await page.goto("/account");
  // Wait for the page's service worker to take over, as an installed app would.
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();

  const notifications = page.getByRole("region", { name: "Notifications" });
  await notifications.getByRole("button", { name: "Turn on notifications" }).click();
  await expect(notifications.getByText("Notifications are on for this device.")).toBeVisible();
  await expect(
    notifications.getByRole("button", { name: "Send a test notification" }),
  ).toBeVisible();

  await notifications.getByRole("button", { name: "Turn off notifications" }).click();
  await expect(notifications.getByRole("button", { name: "Turn on notifications" })).toBeVisible();
});
