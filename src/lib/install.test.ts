import { describe, expect, it } from "vitest";

import { installAction } from "./install";

describe("installAction", () => {
  it("fires the browser's offer wherever one was made", () => {
    expect(installAction({ installed: false, offer: true, ios: false, touch: false })).toBe(
      "prompt",
    );
    expect(installAction({ installed: false, offer: true, ios: false, touch: true })).toBe(
      "prompt",
    );
  });

  it("shows the share sheet's way on iOS, which makes no offer", () => {
    expect(installAction({ installed: false, offer: false, ios: true, touch: true })).toBe(
      "guide-ios",
    );
  });

  it("shows the browser menu's way on a phone whose browser made none", () => {
    expect(installAction({ installed: false, offer: false, ios: false, touch: true })).toBe(
      "guide-browser",
    );
  });

  it("stays away from a desktop browser that offers nothing", () => {
    expect(installAction({ installed: false, offer: false, ios: false, touch: false })).toBeNull();
  });

  it("stays away once the app runs installed", () => {
    expect(installAction({ installed: true, offer: true, ios: true, touch: true })).toBeNull();
  });
});
