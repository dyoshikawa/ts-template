/**
 * The identifiers Better Auth's email OTP plugin stores a user's codes under
 * (`<type>-otp-<email>`, the address lowercased). Matched exactly: a `LIKE`
 * pattern would read `_` and `%` in an address as wildcards and could delete
 * another user's codes.
 */
export function otpIdentifiers(email: string): string[] {
  const address = email.toLowerCase();
  return ["sign-in", "email-verification", "forget-password"].map(
    (type) => `${type}-otp-${address}`,
  );
}
