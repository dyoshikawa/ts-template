import { type Page } from "@playwright/test";

import { expect, test } from "./fixtures";

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
