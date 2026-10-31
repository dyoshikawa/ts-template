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
