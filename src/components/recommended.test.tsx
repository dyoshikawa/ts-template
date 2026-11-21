import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { en } from "../i18n/en";
import { ja } from "../i18n/ja";
import { RecommendedBadge, recommendedFirst } from "./recommended";

afterEach(() => {
  cleanup();
});

describe("RecommendedBadge", () => {
  it("reads おすすめ in Japanese, with its emoji hidden from screen readers", () => {
    render(
      <button type="button">
        Remove.bg <RecommendedBadge />
      </button>,
    );
    const button = screen.getByRole("button", { name: "Remove.bg おすすめ" });
    expect(button.querySelector("[aria-hidden='true']")?.textContent).toBe("⭐");
  });
});

describe("common.recommendedOption", () => {
  it("marks a select option's text in both languages", () => {
    expect(ja.common.recommendedOption({ label: "Remove.bg" })).toBe("Remove.bg（おすすめ）");
    expect(en.common.recommendedOption({ label: "Remove.bg" })).toBe("Remove.bg (Recommended)");
  });
});

describe("recommendedFirst", () => {
  it("moves the recommended means to the front and keeps the others in order", () => {
    const means = ["a", "b", "c", "d"] as const;
    expect(recommendedFirst({ items: means, isRecommended: (item) => item === "c" })).toEqual([
      "c",
      "a",
      "b",
      "d",
    ]);
  });

  it("leaves the list it was given untouched, and as it is when none is recommended", () => {
    const means = ["a", "b"];
    expect(recommendedFirst({ items: means, isRecommended: () => false })).toEqual(["a", "b"]);
    recommendedFirst({ items: means, isRecommended: (item) => item === "b" });
    expect(means).toEqual(["a", "b"]);
  });
});
