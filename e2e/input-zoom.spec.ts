import { type Page } from "@playwright/test";

import { expect, signIn, test } from "./fixtures";

/**
 * The font size of every visible text field on the page. iOS Safari zooms
 * into a field smaller than 16 px when it is tapped.
 */
function fieldFontSizes(page: Page): Promise<{ name: string; size: number }[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll("input, select, textarea")]
      .filter(
        (field) => !["checkbox", "radio", "hidden"].includes((field as HTMLInputElement).type),
      )
      .filter((field) => (field as HTMLElement).offsetParent !== null)
      .map((field) => ({
        name: field.getAttribute("name") ?? field.tagName,
        size: Number.parseFloat(getComputedStyle(field).fontSize),
      })),
  );
}

async function expectNoZoom(page: Page) {
  const fields = await fieldFontSizes(page);
  expect(fields.length).toBeGreaterThan(0);
  for (const field of fields) {
    expect(field.size, `${field.name} would make iOS zoom`).toBeGreaterThanOrEqual(16);
  }
}

test("no text field is small enough for iOS to zoom into", async ({ page, email }) => {
  await page.goto("/login");
  await expectNoZoom(page);

  await page.getByRole("textbox", { name: "Email address" }).fill(email);
  await page.getByRole("button", { name: "Send code" }).click();
  await expect(page.getByRole("textbox", { name: "Sign-in code" })).toBeVisible();
  await expectNoZoom(page);
});

test("the signed-in screens have no small text fields either", async ({ page, email }) => {
  await signIn({ page, email });
  for (const path of ["/", "/account"]) {
    await page.goto(path);
    const fields = await fieldFontSizes(page);
    for (const field of fields) {
      expect(field.size, `${field.name} on ${path} would make iOS zoom`).toBeGreaterThanOrEqual(16);
    }
  }
});
