import { afterEach, describe, expect, it } from "vite-plus/test";

import {
  isStandalone,
  PULL_THRESHOLD,
  pullBlockedAt,
  pullDistance,
  pullFrame,
  releaseReloads,
  startsInPullBand,
} from "./pull-to-reload";

describe("pullDistance", () => {
  it("follows the finger down and is nothing when it moved up", () => {
    expect(pullDistance(100)).toBe(100);
    expect(pullDistance(-50)).toBe(0);
  });
});

describe("startsInPullBand", () => {
  it("lets a pull start only within 96 px of the top edge, below the safe area", () => {
    expect(startsInPullBand({ y: 0, safeTop: 0 })).toBe(true);
    expect(startsInPullBand({ y: 96, safeTop: 0 })).toBe(true);
    expect(startsInPullBand({ y: 97, safeTop: 0 })).toBe(false);
    expect(startsInPullBand({ y: 130, safeTop: 47 })).toBe(true);
    expect(startsInPullBand({ y: 144, safeTop: 47 })).toBe(false);
  });
});

describe("releaseReloads", () => {
  it("reloads past the threshold only", () => {
    expect(releaseReloads(300)).toBe(true);
    expect(releaseReloads(40)).toBe(false);
    expect(releaseReloads(PULL_THRESHOLD)).toBe(true);
  });
});

describe("pullFrame", () => {
  it("slides the badge down slower than the finger, up to a limit", () => {
    const short = pullFrame({ pull: 40, reducedMotion: false });
    expect(short.travel).toBeGreaterThan(0);
    expect(short.travel).toBeLessThan(40);
    expect(pullFrame({ pull: 1000, reducedMotion: false }).travel).toBeLessThanOrEqual(112);
  });

  it("winds the icon up in proportion to the pull, ready at the threshold", () => {
    expect(pullFrame({ pull: 0, reducedMotion: false })).toMatchObject({
      rotate: 0,
      scale: 0.6,
      opacity: 0,
      ready: false,
    });
    expect(pullFrame({ pull: 40, reducedMotion: false })).toMatchObject({
      rotate: 135,
      scale: 0.8,
      opacity: 0.5,
      ready: false,
    });
    expect(pullFrame({ pull: PULL_THRESHOLD, reducedMotion: false })).toMatchObject({
      rotate: 270,
      scale: 1,
      opacity: 1,
      ready: true,
    });
  });

  it("neither turns nor scales with reduced motion", () => {
    expect(pullFrame({ pull: 40, reducedMotion: true })).toMatchObject({
      rotate: 0,
      scale: 1,
      opacity: 0.5,
    });
  });
});

/** A `matchMedia` that matches `matching` only. */
function media(matching: string | null) {
  return (query: string) => ({ matches: query === matching });
}

describe("isStandalone", () => {
  it("is true for an installed app on Android or desktop", () => {
    expect(
      isStandalone({
        matchMedia: media("(display-mode: standalone)"),
        navigatorStandalone: undefined,
      }),
    ).toBe(true);
  });

  it("is true for a home-screen app on iOS", () => {
    expect(isStandalone({ matchMedia: media(null), navigatorStandalone: true })).toBe(true);
  });

  it("is false in a browser tab", () => {
    expect(
      isStandalone({ matchMedia: media("(display-mode: browser)"), navigatorStandalone: false }),
    ).toBe(false);
  });
});

/** The innermost element of `html`, put in the page. */
function inside(html: string): Element {
  document.body.innerHTML = html;
  let element: Element = document.body;
  while (element.lastElementChild) {
    element = element.lastElementChild;
  }
  return element;
}

describe("pullBlockedAt", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("lets a pull start on the page itself", () => {
    expect(pullBlockedAt(inside("<header><a href='/'>Home</a></header>"))).toBe(false);
  });

  it("keeps it out of popups, the open menu and form fields", () => {
    expect(pullBlockedAt(inside("<dialog open><p>Body</p></dialog>"))).toBe(true);
    expect(pullBlockedAt(inside("<div data-no-pull><a href='/'>Home</a></div>"))).toBe(true);
    expect(pullBlockedAt(inside("<label><input></label>"))).toBe(true);
    expect(pullBlockedAt(inside("<div contenteditable='true'><p>Text</p></div>"))).toBe(true);
  });

  it("keeps it out of anything with a drag of its own, such as an area picker", () => {
    expect(
      pullBlockedAt(inside("<div style='touch-action: none'><div><span>Grip</span></div></div>")),
    ).toBe(true);
  });

  it("keeps it out of a scrolled-down inner list", () => {
    const row = inside("<ul><li>Row</li></ul>");
    const list = row.parentElement;
    if (list) {
      // jsdom lays nothing out, so the scroll offset is set by hand.
      Object.defineProperty(list, "scrollTop", { value: 40 });
    }
    expect(pullBlockedAt(row)).toBe(true);
  });
});
