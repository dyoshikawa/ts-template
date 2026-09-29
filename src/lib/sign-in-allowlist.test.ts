import { describe, expect, it } from "vitest";

import { isEmailAllowed, parseAllowedEmails } from "./sign-in-allowlist";

describe("parseAllowedEmails", () => {
  it("splits on commas, trims and lower-cases", () => {
    expect(parseAllowedEmails(" A@Example.com, b@example.com ,,")).toEqual(
      new Set(["a@example.com", "b@example.com"]),
    );
  });

  it("is empty when unset", () => {
    expect(parseAllowedEmails(undefined).size).toBe(0);
    expect(parseAllowedEmails("").size).toBe(0);
  });
});

describe("isEmailAllowed", () => {
  it("lets everybody in when no list is configured", () => {
    expect(isEmailAllowed("anyone@example.com", undefined)).toBe(true);
    expect(isEmailAllowed("anyone@example.com", "")).toBe(true);
  });

  it("only lets the listed addresses in, ignoring case", () => {
    expect(isEmailAllowed("Owner@Example.com", "owner@example.com")).toBe(true);
    expect(isEmailAllowed("other@example.com", "owner@example.com")).toBe(false);
  });
});
