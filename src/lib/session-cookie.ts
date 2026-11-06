/**
 * Whether a request's `Cookie` header carries a Better Auth session token,
 * under any of its names (`better-auth.session_token` on plain `http`,
 * `__Host-better-auth.session_token` on `https`, see `cookieAdvanced`).
 *
 * Better Auth answers `getSession` with `null` straight away when there is no
 * such cookie (with the cookie cache on), so without one the session is
 * known without loading Better Auth at all. Any cookie whose name ends in
 * `session_token` counts, so a false `true` only costs the full lookup; it
 * never skips one.
 */
export function hasSessionCookie(cookieHeader: string | null): boolean {
  if (!cookieHeader) {
    return false;
  }
  return cookieHeader.split(";").some((pair) => {
    const name = pair.split("=", 1)[0]?.trim() ?? "";
    return name.endsWith("session_token");
  });
}
