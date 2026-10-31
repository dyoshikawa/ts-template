import { describe, expect, it } from "vite-plus/test";

import { formatOtp, normalizeOtp, OTP_LENGTH } from "./otp-code";

describe("normalizeOtp", () => {
  it("keeps only the digits", () => {
    expect(normalizeOtp("1234-5678")).toBe("12345678");
    expect(normalizeOtp(" 1234 5678 ")).toBe("12345678");
  });

  it("stops at the code's length", () => {
    expect(normalizeOtp("1234-56789")).toHaveLength(OTP_LENGTH);
  });
});

describe("formatOtp", () => {
  it("puts a hyphen between the two groups of four", () => {
    expect(formatOtp("12345678")).toBe("1234-5678");
  });

  it("adds the hyphen only once a digit follows it", () => {
    expect(formatOtp("1234")).toBe("1234");
    expect(formatOtp("12345")).toBe("1234-5");
  });

  it("formats a code typed with its hyphen the same", () => {
    expect(formatOtp("1234-5678")).toBe("1234-5678");
  });
});
