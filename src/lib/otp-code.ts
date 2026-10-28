/** Digits in an emailed sign-in code. */
export const OTP_LENGTH = 8;

/** The code's digits sit in groups of this many, joined by a hyphen. */
const OTP_GROUP_LENGTH = 4;

/**
 * The digits of whatever was typed or pasted, at most `OTP_LENGTH` of them:
 * the hyphen (or a space) the user copied from the email is dropped, so the
 * user never has to type it.
 */
export function normalizeOtp(input: string): string {
  return input.replaceAll(/\D/g, "").slice(0, OTP_LENGTH);
}

/**
 * The code as shown to people, `1234-5678`. A partial code gets its hyphen
 * only once a digit follows it, so deleting back over the hyphen works.
 */
export function formatOtp(otp: string): string {
  const digits = normalizeOtp(otp);
  if (digits.length <= OTP_GROUP_LENGTH) return digits;
  return `${digits.slice(0, OTP_GROUP_LENGTH)}-${digits.slice(OTP_GROUP_LENGTH)}`;
}
