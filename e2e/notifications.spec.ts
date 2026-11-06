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

  const notifications = page.getByRole("region", { name: "通知" });
  await notifications.getByRole("button", { name: "通知をオンにする" }).click();
  await expect(notifications.getByText("この端末の通知はオンです。")).toBeVisible();
  await expect(notifications.getByRole("button", { name: "テスト通知を送る" })).toBeVisible();

  await notifications.getByRole("button", { name: "通知をオフにする" }).click();
  await expect(notifications.getByRole("button", { name: "通知をオンにする" })).toBeVisible();
});

test("a failure to turn notifications on or to test them says what kind it was", async ({
  page,
  email,
}) => {
  await signIn({ page, email });
  await page.goto("/account");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  const notifications = page.getByRole("region", { name: "通知" });
  const message = notifications.getByRole("status");

  // The server cannot store the subscription.
  let answer: "fail" | "offline" | "pass" = "fail";
  await page.route("**/_serverFn/**", async (route) => {
    if (route.request().method() !== "POST" || answer === "pass") {
      await route.continue();
    } else if (answer === "offline") {
      await route.abort("failed");
    } else {
      await route.fulfill({ status: 500, contentType: "text/plain", body: "boom" });
    }
  });
  const turnOn = notifications.getByRole("button", { name: "通知をオンにする" });
  await turnOn.click();
  await expect(message).toHaveText(/^通知をオンにできませんでした。サーバーでエラーが起きました/u);

  // The browser's push service turns the subscription down.
  await page.evaluate(() => {
    Object.assign(PushManager.prototype, {
      getSubscription: async () => null,
      subscribe: async () => {
        throw new DOMException("Registration failed - push service error", "AbortError");
      },
    });
  });
  await turnOn.click();
  await expect(message).toHaveText(
    /^通知をオンにできませんでした。ブラウザーのプッシュ通知の仕組みが応じませんでした（AbortError）/u,
  );
  await page.reload();

  answer = "pass";
  await turnOn.click();
  await expect(notifications.getByText("この端末の通知はオンです。")).toBeVisible();
  answer = "offline";
  await notifications.getByRole("button", { name: "テスト通知を送る" }).click();
  await expect(message).toHaveText(
    /^テスト通知を送れませんでした。サーバーに接続できませんでした/u,
  );
});
