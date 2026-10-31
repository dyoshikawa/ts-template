import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { BusyLabel } from "./spinner";

afterEach(() => {
  cleanup();
});

describe("BusyLabel", () => {
  it("puts the emoji in front of the label, hidden from screen readers", () => {
    render(
      <button type="button">
        <BusyLabel emoji="🔔">Turn on</BusyLabel>
      </button>,
    );
    const button = screen.getByRole("button", { name: "Turn on" });
    expect(button.textContent).toBe("🔔Turn on");
    expect(button.querySelector("[aria-hidden='true']")?.textContent).toBe("🔔");
    expect(button.querySelector("[data-spinner]")).toBeNull();
  });

  it("swaps the emoji for a spinner while busy, keeping the label", () => {
    render(
      <button type="button">
        <BusyLabel busy emoji="🔔">
          Turn on
        </BusyLabel>
      </button>,
    );
    const button = screen.getByRole("button", { name: "Turn on" });
    expect(button.querySelector("[data-spinner]")).not.toBeNull();
    expect(button.textContent).not.toContain("🔔");
  });
});
