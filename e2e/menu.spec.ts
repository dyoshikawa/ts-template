import { expect, test } from "./fixtures";

test("the closed menu is not drawn, so its shadow never shades the left edge", async ({ page }) => {
  await page.goto("/");
  const panel = page.locator("nav[aria-label=ts-template]");
  await expect(panel).toHaveCSS("visibility", "hidden");
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await expect(page.getByRole("navigation", { name: "ts-template" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCSS("visibility", "hidden");
});
