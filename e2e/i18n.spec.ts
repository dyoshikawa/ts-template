import { type Page } from "@playwright/test";

import { expect, signIn, test } from "./fixtures";

// The app speaks Japanese and English: Japanese for the rest of the suite,
// English here.

const JAPANESE = /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u;

/**
 * The visible text of the app's own chrome that is in Japanese, leaving out
 * what is Japanese on purpose: the language switcher's 「日本語」 (marked
 * `lang="ja"`).
 */
function japaneseLeft(page: Page): Promise<string[]> {
  return page.evaluate((source) => {
    const japanese = new RegExp(source, "u");
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const found: string[] = [];
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const parent = node.parentElement;
      const text = node.textContent?.trim() ?? "";
      if (
        !parent ||
        text === "" ||
        parent.closest("[lang=ja], script, style") ||
        parent.closest("[inert], [aria-hidden=true]") ||
        parent.offsetParent === null
      ) {
        continue;
      }
      if (japanese.test(text)) {
        found.push(text);
      }
    }
    for (const element of document.querySelectorAll("[aria-label], [placeholder], [title]")) {
      for (const name of ["aria-label", "placeholder", "title"]) {
        const value = element.getAttribute(name) ?? "";
        if (japanese.test(value) && !element.closest("[lang=ja]")) {
          found.push(value);
        }
      }
    }
    if (japanese.test(document.title)) {
      found.push(document.title);
    }
    return found;
  }, JAPANESE.source);
}

/** Whether anything sticks out sideways (an English label that does not fit). */
function overflowsSideways(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
}

test.describe("in English", () => {
  test.use({ locale: "en-US" });

  test("the main screens and popups have no Japanese left and fit a small phone", async ({
    page,
    email,
  }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto("/login");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    expect(await japaneseLeft(page)).toEqual([]);
    expect(await overflowsSideways(page)).toBe(false);

    await page.getByRole("textbox", { name: "Email address" }).fill(email);
    await page.getByRole("button", { name: "Send code" }).click();
    await expect(page.getByRole("textbox", { name: "Sign-in code" })).toBeVisible();
    expect(await japaneseLeft(page)).toEqual([]);

    await page.getByRole("textbox", { name: "Sign-in code" }).fill("12345678");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForURL("/");
    await expect(page.getByText(`Signed in as ${email}`)).toBeVisible();
    expect(await japaneseLeft(page)).toEqual([]);
    expect(await overflowsSideways(page)).toBe(false);

    await page.getByRole("button", { name: "Menu", exact: true }).click();
    await expect(page.getByRole("navigation", { name: "ts-template" })).toBeVisible();
    expect(await japaneseLeft(page)).toEqual([]);
    await page
      .getByRole("navigation", { name: "ts-template" })
      .getByRole("button", { name: "Add to Home Screen" })
      .click();
    await expect(
      page.getByRole("dialog", { name: "How to add to your Home Screen" }),
    ).toBeVisible();
    expect(await japaneseLeft(page)).toEqual([]);
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");

    await page.goto("/account");
    await expect(page.getByRole("heading", { name: "Account", exact: true })).toBeVisible();
    await expect(page).toHaveTitle("Account — ts-template");
    expect(await japaneseLeft(page)).toEqual([]);
    expect(await overflowsSideways(page)).toBe(false);
  });
});

test("switching to English takes effect at once and outlasts a reload and a sign-out", async ({
  page,
  email,
}) => {
  await signIn({ page, email });
  await page.goto("/account");
  await expect(page.getByRole("heading", { name: "アカウント", exact: true })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "ja");

  await page.getByRole("button", { name: "English" }).click();
  await expect(page.getByRole("heading", { name: "Account", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "English" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  // Still on the same screen.
  expect(new URL(page.url()).pathname).toBe("/account");

  await page.reload();
  await expect(page.getByRole("heading", { name: "Account", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.getByRole("link", { name: email })).toHaveCount(0);
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("a signed-in user's choice follows them to another browser", async ({
  page,
  browser,
  email,
}) => {
  await signIn({ page, email });
  await page.getByRole("button", { name: "メニュー", exact: true }).click();
  await page.getByRole("button", { name: "English" }).click();
  await expect(page.getByRole("button", { name: "Menu", exact: true })).toBeVisible();

  // A fresh browser asking for Japanese, without the cookie.
  const other = await browser.newContext({ locale: "ja-JP" });
  const second = await other.newPage();
  await signIn({ page: second, email });
  await second.goto("/account");
  await expect(second.getByRole("heading", { name: "Account", exact: true })).toBeVisible();
  await other.close();
});

test("a choice that could not be saved switches back and says so", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "メニュー", exact: true })).toBeVisible();
  await page.route(
    (url) => url.pathname.startsWith("/_serverFn"),
    async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({ status: 500, body: "boom" });
        return;
      }
      await route.continue();
    },
  );
  await page.getByRole("button", { name: "メニュー", exact: true }).click();
  await page.getByRole("button", { name: "English" }).click();
  const snackbar = page.getByTestId("snackbar");
  await expect(snackbar).toContainText("言語を保存できませんでした");
  await expect(page.getByRole("button", { name: "日本語" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator("html")).toHaveAttribute("lang", "ja");
});
