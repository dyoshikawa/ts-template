import { type Page } from "@playwright/test";

import { expect, signIn, test } from "./fixtures";

/**
 * Gives the page a virtual platform authenticator (Chromium's WebAuthn
 * domain) that holds discoverable credentials and passes user verification
 * by itself, so no dialog has to be answered.
 */
async function addVirtualAuthenticator(page: Page): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
}

/**
 * Makes the email field's passkey suggestions (conditional mediation) wait
 * as they do for a user who never taps one: the virtual authenticator would
 * answer them at once and sign in before the button is pressed. The wait
 * ends only when a new request aborts it, as the button's does.
 */
async function holdAutoFill(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const get = navigator.credentials.get.bind(navigator.credentials);
    navigator.credentials.get = async (options) => {
      if (options?.mediation !== "conditional") {
        return get(options);
      }
      return new Promise((_resolve, reject) => {
        options.signal?.addEventListener("abort", () => {
          reject(new DOMException("aborted", "AbortError"));
        });
      });
    };
  });
}

/** Counts the passkey challenges the page asks for (one per WebAuthn request). */
function countChallenges(page: Page): () => number {
  let count = 0;
  page.on("request", (request) => {
    if (request.url().includes("/passkey/generate-authenticate-options")) {
      count += 1;
    }
  });
  return () => count;
}

async function signOut(page: Page): Promise<void> {
  await page.getByRole("button", { name: "メニュー", exact: true }).click();
  await page.getByRole("button", { name: "サインアウト", exact: true }).click();
  await expect(page.getByRole("link", { name: "サインイン" }).first()).toBeVisible();
}

// Local runs offer passkeys on the default ports only (`LOCAL_ORIGINS` in
// src/lib/passkey.ts); a run moved with `E2E_PORT` has none to test.
test.skip(
  ![undefined, "4173"].includes(process.env.E2E_PORT),
  "passkeys are offered on localhost:4173 only",
);

const OFFER_HEADING = "次回はパスキーでサインインしますか？";
/** The label the iPhone descriptor's user agent gives a new passkey. */
const LABEL = "Safari · iPhone";

test("a passkey offered after the email sign-in signs in later and can be deleted", async ({
  page,
  email,
}) => {
  await holdAutoFill(page);
  await addVirtualAuthenticator(page);
  const challenges = countChallenges(page);
  await signIn({ page, email });

  // Offered once, on the home page.
  await expect(page.getByRole("heading", { name: OFFER_HEADING })).toBeVisible();
  await page.getByRole("button", { name: "パスキーを追加" }).click();
  await expect(page.getByRole("heading", { name: "パスキーを追加しました" })).toBeVisible();

  // Listed under the device and browser it was made on.
  await page.goto("/account");
  await expect(page.getByText(LABEL)).toBeVisible();

  await signOut(page);
  await page.goto("/login");
  await page.getByRole("button", { name: "パスキーでサインイン" }).click();
  await page.waitForURL("/");
  await expect(page.getByRole("link", { name: email })).toBeVisible();
  // Signing in with a passkey offers no second one.
  await expect(page.getByRole("heading", { name: OFFER_HEADING })).toHaveCount(0);

  await page.goto("/account");
  page.once("dialog", (dialog) => {
    void dialog.accept();
  });
  await page.getByRole("button", { name: `「${LABEL}」を削除` }).click();
  await expect(page.getByText("パスキーはまだありません。")).toBeVisible();

  // The deleted passkey no longer signs in; email still does. Signing out on
  // the account page sends the browser on to /login, whose own challenge is
  // waited for so that it is not counted for the visit below.
  const beforeSignOut = challenges();
  await signOut(page);
  await expect.poll(challenges).toBeGreaterThan(beforeSignOut);
  const beforeVisit = challenges();
  await page.goto("/login");
  // The email field waits for a suggestion (this visit's own challenge); the
  // button aborts that wait, and its failure starts the wait again (a challenge
  // asked for after the press's) without wiping the message, which a restart
  // would do before asking.
  await expect.poll(challenges).toBeGreaterThan(beforeVisit);
  const before = challenges();
  await page.getByRole("button", { name: "パスキーでサインイン" }).click();
  const alert = page.getByRole("alert");
  await expect(alert).toContainText("メールアドレスでサインインしてください");
  await expect.poll(challenges).toBeGreaterThanOrEqual(before + 2);
  await expect(alert).toContainText("メールアドレスでサインインしてください");
});

test("the email field's passkey suggestion signs in", async ({ page, email }) => {
  await addVirtualAuthenticator(page);
  await signIn({ page, email });
  await page.getByRole("button", { name: "パスキーを追加" }).click();
  await expect(page.getByRole("heading", { name: "パスキーを追加しました" })).toBeVisible();
  await signOut(page);

  // The virtual authenticator picks the suggestion by itself, as a user tapping it would.
  await page.goto("/login");
  await page.waitForURL("/");
  await expect(page.getByRole("link", { name: email })).toBeVisible();
});

test('"今はしない" stops the offer on this device', async ({ page, email }) => {
  await addVirtualAuthenticator(page);
  await signIn({ page, email });
  await page.getByRole("button", { name: "今はしない" }).click();
  await expect(page.getByRole("heading", { name: OFFER_HEADING })).toHaveCount(0);

  await signOut(page);
  await signIn({ page, email });
  await expect(page.getByRole("heading", { name: OFFER_HEADING })).toHaveCount(0);

  // The account page still adds one.
  await page.goto("/account");
  await page.getByRole("button", { name: "この端末でパスキーを追加" }).click();
  await expect(page.getByText("パスキーを追加しました。")).toBeVisible();
  await expect(page.getByText(LABEL)).toBeVisible();
});

test("leaving the home page unanswered ends the offer", async ({ page, email }) => {
  await addVirtualAuthenticator(page);
  await signIn({ page, email });
  await expect(page.getByRole("heading", { name: OFFER_HEADING })).toBeVisible();
  await page.goto("/account");
  await page.goto("/");
  await expect(page.getByRole("link", { name: email })).toBeVisible();
  await expect(page.getByRole("heading", { name: OFFER_HEADING })).toHaveCount(0);
});

test("a signed-out session's cookies cannot add a passkey", async ({ page, email }) => {
  await signIn({ page, email });
  const cookies = await page.context().cookies();
  await signOut(page);

  // The copied cookies still carry the 5-minute session cache, which the
  // endpoint alone would trust; the session row is gone, so it is refused.
  await page.context().addCookies(cookies);
  const response = await page.request.get("/api/auth/passkey/generate-register-options");
  expect(response.status()).toBe(401);
});

test("renaming a passkey is switched off", async ({ request }) => {
  const response = await request.post("/api/auth/passkey/update-passkey", {
    data: { id: "x", name: "y" },
  });
  expect(response.status()).toBe(404);
});

test("the nightly Cron Trigger clears expired challenges without failing", async ({ request }) => {
  const response = await request.get("/cdn-cgi/local/scheduled");
  expect(response.status()).toBe(200);
});
