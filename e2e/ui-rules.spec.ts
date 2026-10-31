import { writeFileSync } from "node:fs";

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
  const open = page.getByRole("button", { name: "ホーム画面に追加" });
  const guide = page.getByRole("dialog", { name: "ホーム画面に追加する方法" });

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
  const openMenu = page.getByRole("button", { name: "メニュー", exact: true });
  const menu = page.getByRole("navigation", { name: "ts-template" });
  const viewport = page.viewportSize();

  await openMenu.click();
  await expect(menu).toBeVisible();
  // Let the slide finish before measuring.
  await expect.poll(async () => (await menu.boundingBox())?.x).toBe(0);
  const box = await menu.boundingBox();
  expect(box?.width).toBe(viewport?.width);
  expect(box?.height).toBe(viewport?.height);

  await menu.getByRole("button", { name: "メニューを閉じる" }).click();
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
  await page.getByRole("textbox", { name: "メールアドレス" }).fill(email);
  const send = page.getByRole("button", { name: "コードを送信" });
  await send.click();
  await expect(send).toBeDisabled();
  await expect(send.locator("[data-spinner]")).toBeVisible();
  expect(await screenIsBlocked(page)).toBe(false);
  await expect(page.getByRole("textbox", { name: "サインインコード" })).toBeVisible();
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
  await page.getByRole("textbox", { name: "メールアドレス" }).fill(email);
  const send = page.getByRole("button", { name: "コードを送信" });
  await send.click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(send.locator("[data-spinner]")).toHaveCount(0);
});

test("a slow page load shows a bar along the top and blocks nothing", async ({ page }) => {
  await page.goto("/");
  const signInLink = page.getByRole("main").getByRole("link", { name: "サインイン" });
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
  await page.getByRole("button", { name: "メニュー", exact: true }).click();
  const signOut = page.getByRole("button", { name: "サインアウト", exact: true });
  await signOut.click();
  await expect(signOut).toBeDisabled();
  await expect(signOut.locator("[data-spinner]")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "ts-template" })).toBeHidden();
  await expect(page.getByRole("link", { name: email })).toHaveCount(0);
});

const HOME_HEADING = "ts-template";

/** Makes the page believe it runs as the installed app (CDP cannot emulate `display-mode`). */
async function fakeStandalone(page: Page) {
  await page.addInitScript(() => {
    const original = window.matchMedia.bind(window);
    window.matchMedia = (query: string) =>
      /display-mode:\s*(standalone|fullscreen|minimal-ui)/.test(query)
        ? ({
            matches: true,
            media: query,
            onchange: null,
            addEventListener: () => {},
            removeEventListener: () => {},
            addListener: () => {},
            removeListener: () => {},
            dispatchEvent: () => false,
          } as MediaQueryList)
        : original(query);
  });
}

/** Pulls one finger down from `y` by `distance` px; answers whether the page reloaded. */
async function pullDown({ page, y, distance }: { page: Page; y: number; distance: number }) {
  await page.evaluate(() => {
    Object.assign(window, { notReloaded: true });
  });
  const cdp = await page.context().newCDPSession(page);
  const touch = (type: "touchStart" | "touchMove" | "touchEnd", at: number) =>
    cdp.send("Input.dispatchTouchEvent", {
      type,
      touchPoints: type === "touchEnd" ? [] : [{ x: 200, y: at }],
    });
  await touch("touchStart", y);
  for (let step = 1; step <= 10; step += 1) {
    // oxlint-disable-next-line no-await-in-loop -- one finger position after another
    await touch("touchMove", y + (distance * step) / 10);
  }
  await touch("touchEnd", y + distance).catch(() => {});
  // A reload drops the marker; give one the time to start.
  await page.waitForTimeout(1500);
  await page.waitForLoadState();
  return page.evaluate(() => !("notReloaded" in window));
}

test("in the installed app a long pull from the top reloads, nothing else does", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.goto("/");
  // In a browser tab the browser's own pull-to-refresh is left alone.
  expect(await pullDown({ page, y: 150, distance: 300 })).toBe(false);

  await fakeStandalone(page);
  await page.reload();
  await expect(page.getByRole("heading", { name: HOME_HEADING })).toBeVisible();
  // A short pull, then a long one.
  expect(await pullDown({ page, y: 150, distance: 40 })).toBe(false);
  expect(await pullDown({ page, y: 150, distance: 300 })).toBe(true);
  await expect(page.getByRole("heading", { name: HOME_HEADING })).toBeVisible();

  // Not from a scrolled-down page.
  await page.evaluate(() => {
    document.body.style.minHeight = "3000px";
    window.scrollTo(0, 400);
  });
  expect(await pullDown({ page, y: 150, distance: 300 })).toBe(false);
  await page.evaluate(() => {
    window.scrollTo(0, 0);
  });

  // Not inside an open popup (the menu here).
  await page.getByRole("button", { name: "メニュー", exact: true }).click();
  await expect(page.getByRole("navigation", { name: "ts-template" })).toBeVisible();
  expect(await pullDown({ page, y: 150, distance: 300 })).toBe(false);
});

test("the pull indicator winds up, turns ready, spins on release and springs back", async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  await page.goto("/");
  await fakeStandalone(page);
  await page.reload();
  await expect(page.getByRole("heading", { name: HOME_HEADING })).toBeVisible();
  const indicator = page.locator("[data-pull-to-reload]");
  const badge = indicator.locator("[data-pull-badge]");
  const icon = indicator.locator("[data-pull-icon]");
  const label = indicator.locator("[data-pull-label]");
  await expect(indicator).toHaveAttribute("data-state", "idle");
  await expect(indicator).toBeHidden();

  const cdp = await page.context().newCDPSession(page);
  const touch = async (type: "touchStart" | "touchMove" | "touchEnd", y = 0) => {
    await cdp.send("Input.dispatchTouchEvent", {
      type,
      touchPoints: type === "touchEnd" ? [] : [{ x: 200, y }],
    });
  };
  const pullTo = async (distance: number) => {
    for (let step = 1; step <= 4; step += 1) {
      await touch("touchMove", 150 + (distance * step) / 4);
    }
  };
  const shot = async (name: string) => {
    await page.screenshot({ path: testInfo.outputPath(`${name}.png`) });
  };

  // 40 px: partly in view and partly wound up (135° of the 270°, scaled and faded in halfway).
  await touch("touchStart", 150);
  await pullTo(40);
  await expect(indicator).toHaveAttribute("data-state", "pulling");
  await expect(icon).toHaveCSS("transform", /^matrix\(-0\.70/);
  await expect(badge).toHaveCSS("opacity", "0.5");
  await expect(badge).toHaveCSS("transform", "matrix(0.8, 0, 0, 0.8, 0, 0)");
  await expect(label).toHaveCSS("opacity", "0");
  await shot("pull-40");

  // 120 px: past the threshold, ready in the accent color with the release label.
  await pullTo(120);
  await expect(indicator).toHaveAttribute("data-state", "ready");
  await expect(badge).toHaveCSS("background-color", "rgb(37, 99, 235)");
  await expect(label).toHaveText("離して更新");
  await expect(label).toHaveCSS("opacity", "1");
  await shot("pull-120");

  // Released: the badge stays and spins until the page goes (the reload is held a moment here).
  const gate: { release?: () => void } = {};
  const held = new Promise<void>((resolve) => {
    gate.release = resolve;
  });
  await page.route("**/*", async (route) => {
    if (route.request().isNavigationRequest()) {
      await held;
    }
    await route.continue();
  });
  // The page as it goes: noted on unload, read back once it has reloaded.
  await page.evaluate(() => {
    addEventListener("beforeunload", () => {
      const going = document.querySelector("[data-pull-to-reload]");
      const spinning = going?.querySelector("[data-pull-icon]");
      sessionStorage.setItem(
        "pullOnUnload",
        JSON.stringify({
          state: going?.getAttribute("data-state"),
          label: going?.querySelector("[data-pull-label]")?.textContent,
          animation: spinning ? getComputedStyle(spinning).animationName : null,
        }),
      );
    });
  });
  await touch("touchEnd");
  // Playwright's own calls (and CDP script or DOM calls) wait on the held
  // navigation, but the old page is still drawn: capture it through CDP.
  await page.waitForTimeout(300);
  const { data } = await cdp.send("Page.captureScreenshot", { format: "png" });
  writeFileSync(testInfo.outputPath("after-release.png"), Buffer.from(data, "base64"));
  gate.release?.();
  await page.waitForLoadState();
  await page.unroute("**/*");
  await expect(page.getByRole("heading", { name: HOME_HEADING })).toBeVisible();
  expect(
    JSON.parse((await page.evaluate(() => sessionStorage.getItem("pullOnUnload"))) ?? "null"),
  ).toEqual({ state: "reloading", label: "更新中…", animation: "pull-to-reload-spin" });

  // A short pull springs back out of view without reloading.
  await page.evaluate(() => {
    Object.assign(window, { notReloaded: true });
  });
  await touch("touchStart", 150);
  await pullTo(40);
  await expect(indicator).toHaveAttribute("data-state", "pulling");
  await touch("touchEnd");
  // Faded out, so its shadow does not peek below the top edge on the way back.
  await expect(badge).toHaveCSS("opacity", "0");
  await expect(indicator).toHaveAttribute("data-state", "idle");
  expect(await page.evaluate(() => "notReloaded" in window)).toBe(true);

  // With reduced motion the icon does not turn or scale; it only shows.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await touch("touchStart", 150);
  await pullTo(120);
  await expect(indicator).toHaveAttribute("data-state", "ready");
  await expect(icon).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, 0)");
  await expect(badge).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, 0)");
  await pullTo(0);
  await touch("touchEnd");
  await expect(indicator).toHaveAttribute("data-state", "idle");
});
