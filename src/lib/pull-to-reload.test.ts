import { describe, expect, it } from "vite-plus/test";

import {
  isStandalone,
  PULL_THRESHOLD,
  pullDistance,
  pullFrame,
  releaseReloads,
} from "./pull-to-reload";

describe("pullDistance", () => {
  it("follows the finger down and is nothing when it moved up", () => {
    expect(pullDistance(100)).toBe(100);
    expect(pullDistance(-50)).toBe(0);
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
