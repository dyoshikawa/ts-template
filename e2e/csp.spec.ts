import { expect, test } from "./fixtures";

test("pages carry a nonce-based policy with a fresh nonce each time", async ({ page }) => {
  const nonceOf = async () => {
    const response = await page.goto("/");
    const policy = response?.headers()["content-security-policy"] ?? "";
    expect(policy).toContain("'strict-dynamic'");
    return /'nonce-([^']+)'/u.exec(policy)?.[1];
  };
  const first = await nonceOf();
  expect(first).toBeTruthy();
  expect(await nonceOf()).not.toBe(first);
});

test("the page still hydrates under the policy", async ({ page }) => {
  await page.goto("/");
  // The menu only opens once React has taken over the server-rendered page.
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await expect(page.getByRole("navigation", { name: "ts-template" })).toBeVisible();
  // Client-side navigation loads the next route's chunk under the policy too.
  await page
    .getByRole("navigation")
    .getByRole("link", { name: /Sign in/u })
    .click();
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});
