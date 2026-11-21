import { setCookie } from "@tanstack/react-start/server";

import { type Language, LANGUAGE_COOKIE, LANGUAGE_COOKIE_MAX_AGE } from "../i18n/language";

/**
 * Writes the language cookie on the response to `request`: site-wide, for a
 * year, and `Secure` on an `https` origin (plain `http` local runs would drop
 * a `Secure` cookie).
 */
export function setLanguageCookie({
  request,
  language,
}: {
  request: Request;
  language: Language;
}): void {
  setCookie(LANGUAGE_COOKIE, language, {
    path: "/",
    maxAge: LANGUAGE_COOKIE_MAX_AGE,
    sameSite: "lax",
    secure: new URL(request.url).protocol === "https:",
  });
}
