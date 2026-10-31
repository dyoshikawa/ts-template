import { type Page } from "@playwright/test";

import { expect, signIn, test } from "./fixtures";

// The owner's UI rules: no pinch zoom, full-height popups on phones, local
// loading indicators and pull to reload in the installed app.

test("the page cannot be pinch-zoomed", async ({ page }) => {
  await page.goto("/login");
  const viewport = await page.locator('meta[name="viewport"]').getAttribute("content");
  expect(viewport).toContain("maximum-scale=1");
  expect(viewport).toContain("user-scalable=no");
  // Only panning: `manipulation` would still let a pinch zoom the page.
  expect(
    await page.evaluate(() =>
      [document.documentElement, document.body, document.querySelector("main")].map((element) =>
        element ? getComputedStyle(element).touchAction : null,
      ),
    ),
  ).toEqual(["pan-x pan-y", "pan-x pan-y", "pan-x pan-y"]);
  // iOS ignores the meta: its gesture events are cancelled in code.
  expect(
    await page.evaluate(() => {
      const gesture = new Event("gesturestart", { cancelable: true });
      document.dispatchEvent(gesture);
      return gesture.defaultPrevented;
    }),
  ).toBe(true);
});

test("the install guide fills a phone's screen and is a centred dialog on a tablet", async ({
  page,
}) => {
  await page.goto("/");
  const open = page.getByRole("button", { name: "Add to Home Screen" });
  const guide = page.getByRole("dialog", { name: "How to add to your Home Screen" });

  await open.click();
  const viewport = page.viewportSize();
  const box = await guide.boundingBox();
  expect(box?.height).toBe(viewport?.height);
  expect(box?.width).toBe(viewport?.width);
  await page.keyboard.press("Escape");
  await expect(guide).toBeHidden();

  await page.setViewportSize({ width: 768, height: 1024 });
  await open.click();
  const tablet = await guide.boundingBox();
  expect(tablet?.height).toBeLessThan(1024 * 0.9);
  expect(tablet?.width).toBeLessThan(768);
});

/** One finger dragged sideways from `from` by `by` px (negative: leftwards), then lifted. */
async function swipeSideways(
  page: Page,
  { from, by }: { from: { x: number; y: number }; by: number },
): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  const touch = (type: "touchStart" | "touchMove" | "touchEnd", x: number) =>
    cdp.send("Input.dispatchTouchEvent", {
      type,
      touchPoints: type === "touchEnd" ? [] : [{ x, y: from.y }],
    });
  await touch("touchStart", from.x);
  const step = by < 0 ? -20 : 20;
  for (let x = from.x + step; Math.abs(x - from.x) <= Math.abs(by); x += step) {
    // oxlint-disable-next-line no-await-in-loop -- one finger position after another
    await touch("touchMove", x);
  }
  await touch("touchEnd", from.x + by);
  await cdp.detach();
}

test("the menu fills a phone's screen and closes on ✕, Escape and a swipe back", async ({
  page,
}) => {
  await page.goto("/");
  const openMenu = page.getByRole("button", { name: "Menu", exact: true });
  const menu = page.getByRole("navigation", { name: "ts-template" });
  const viewport = page.viewportSize();

  await openMenu.click();
  await expect(menu).toBeVisible();
  // Let the slide finish before measuring.
  await expect.poll(async () => (await menu.boundingBox())?.x).toBe(0);
  const box = await menu.boundingBox();
  expect(box?.width).toBe(viewport?.width);
  expect(box?.height).toBe(viewport?.height);

  await menu.getByRole("button", { name: "Close menu" }).click();
  await expect(menu).toBeHidden();

  await openMenu.click();
  await expect(menu).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();

  // A short sideways drag springs back; a swipe toward the left edge closes.
  await openMenu.click();
  await expect.poll(async () => (await menu.boundingBox())?.x).toBe(0);
  await swipeSideways(page, { from: { x: 300, y: 300 }, by: -40 });
  await expect.poll(async () => (await menu.boundingBox())?.x).toBe(0);
  await expect(menu).toBeVisible();
  await swipeSideways(page, { from: { x: 300, y: 300 }, by: -160 });
  await expect(menu).toBeHidden();

  // From tablet width up it is a panel beside the dimmed page.
  await page.setViewportSize({ width: 768, height: 1024 });
  await openMenu.click();
  await expect.poll(async () => (await menu.boundingBox())?.x).toBe(0);
  expect((await menu.boundingBox())?.width).toBeLessThan(768 / 2);
});

/** Holds every request matching `match` back by `ms`, so its wait can be seen. */
async function delay(page: Page, match: (url: URL) => boolean, ms = 1500): Promise<void> {
  await page.route(match, async (route) => {
    await new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
    await route.continue();
  });
}

/** Whether anything fixed covers most of the screen (a blocking overlay). */
function screenIsBlocked(page: Page): Promise<boolean> {
  return page.evaluate(() =>
    [...document.querySelectorAll("body *")].some((element) => {
      const style = getComputedStyle(element);
      const box = element.getBoundingClientRect();
      return (
        style.position === "fixed" &&
        style.visibility !== "hidden" &&
        style.pointerEvents !== "none" &&
        box.width * box.height > innerWidth * innerHeight * 0.5
      );
    }),
  );
}

test("a button waiting on the server spins in place and blocks nothing", async ({
  page,
  email,
}) => {
  await page.goto("/login");
  await delay(page, (url) => url.pathname.endsWith("/email-otp/send-verification-otp"));
  await page.getByRole("textbox", { name: "Email address" }).fill(email);
  const send = page.getByRole("button", { name: "Send code" });
  await send.click();
  await expect(send).toBeDisabled();
  await expect(send.locator("[data-spinner]")).toBeVisible();
  expect(await screenIsBlocked(page)).toBe(false);
  await expect(page.getByRole("textbox", { name: "Sign-in code" })).toBeVisible();
});

test("a failed request clears the spinner and says so where the user acted", async ({
  page,
  email,
}) => {
  await page.goto("/login");
  await page.route(
    (url) => url.pathname.endsWith("/email-otp/send-verification-otp"),
    (route) => route.fulfill({ status: 500, json: { message: "boom" } }),
  );
  await page.getByRole("textbox", { name: "Email address" }).fill(email);
  const send = page.getByRole("button", { name: "Send code" });
  await send.click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(send.locator("[data-spinner]")).toHaveCount(0);
});

test("a slow page load shows a bar along the top and blocks nothing", async ({ page }) => {
  await page.goto("/");
  const signInLink = page.getByRole("main").getByRole("link", { name: "Sign in" });
  await expect(signInLink).toBeVisible();
  // Every navigation asks the server for the session first: hold those back.
  await delay(page, (url) => url.pathname.startsWith("/_serverFn"));
  await signInLink.click();
  const bar = page.getByTestId("navigation-progress");
  await expect(bar).toBeVisible();
  expect((await bar.boundingBox())?.height).toBeLessThan(8);
  expect(await screenIsBlocked(page)).toBe(false);
  await page.waitForURL("/login");
  await expect(bar).toHaveCount(0);
});

test("signing out keeps the menu open with a spinner until the session is gone", async ({
  page,
  email,
}) => {
  await signIn({ page, email });
  await delay(page, (url) => url.pathname.endsWith("/api/auth/sign-out"));
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  const signOut = page.getByRole("button", { name: "Sign out", exact: true });
  await signOut.click();
  await expect(signOut).toBeDisabled();
  await expect(signOut.locator("[data-spinner]")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "ts-template" })).toBeHidden();
  await expect(page.getByRole("link", { name: email })).toHaveCount(0);
});
