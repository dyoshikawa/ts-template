import { describe, expect, it } from "vite-plus/test";

import { otpIdentifiers } from "./otp-identifiers";

describe("otpIdentifiers", () => {
  it("names every kind of code stored for the address, lowercased", () => {
    expect(otpIdentifiers("Ann_1@Example.com")).toEqual([
      "sign-in-otp-ann_1@example.com",
      "email-verification-otp-ann_1@example.com",
      "forget-password-otp-ann_1@example.com",
    ]);
  });
});
