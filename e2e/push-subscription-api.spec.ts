import { expect, signIn, test } from "./fixtures";

const SUBSCRIPTION = {
  endpoint: "https://fcm.googleapis.com/fcm/send/e2e-renewed",
  p256dh: "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
  auth: "BTBZMqHH6r4Tts7J_aSIgg",
};

// The endpoint the service worker posts a renewed subscription to.
test.describe("POST /api/push/subscription", () => {
  test("refuses a signed-out request", async ({ request }) => {
    const response = await request.post("/api/push/subscription", { data: SUBSCRIPTION });
    expect(response.status()).toBe(401);
  });

  test("stores a subscription for the signed-in user", async ({ page, email }) => {
    await signIn({ page, email });
    const response = await page.request.post("/api/push/subscription", { data: SUBSCRIPTION });
    expect(response.status()).toBe(204);
  });

  test("refuses another origin, a form post and an unknown endpoint", async ({ page, email }) => {
    await signIn({ page, email });
    const crossSite = await page.request.post("/api/push/subscription", {
      data: SUBSCRIPTION,
      headers: { Origin: "https://attacker.example.com" },
    });
    expect(crossSite.status()).toBe(403);

    const form = await page.request.post("/api/push/subscription", {
      headers: { "Content-Type": "text/plain" },
      data: JSON.stringify(SUBSCRIPTION),
    });
    expect(form.status()).toBe(415);

    const unknown = await page.request.post("/api/push/subscription", {
      data: { ...SUBSCRIPTION, endpoint: "https://attacker.example.com/push" },
    });
    expect(unknown.status()).toBe(400);
  });
});
