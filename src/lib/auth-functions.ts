import { createServerFn } from "@tanstack/react-start";
import { getRequest, setCookie } from "@tanstack/react-start/server";

import {
  type Language,
  LANGUAGE_COOKIE,
  LANGUAGE_COOKIE_MAX_AGE,
  languageFromCookie,
  requestLanguage,
} from "../i18n/language";
import { createAuth } from "./auth";

/**
 * What every route needs before it renders, read once per navigation: the
 * signed-in user (or `null`) and the language to speak. Only what the pages
 * show is returned — never the session row, whose token would otherwise be
 * serialized into the HTML. The language is resolved here, on the server,
 * so the first render is already in it.
 */
export const getRootContext = createServerFn({ method: "GET" }).handler(async () => {
  const request = getRequest();
  const found = await createAuth({ request }).api.getSession({ headers: request.headers });
  const session = found
    ? {
        user: {
          id: found.user.id,
          email: found.user.email,
          name: found.user.name,
          language: found.user.language ?? null,
        },
      }
    : null;
  const language: Language = requestLanguage({ request, saved: session?.user.language });
  // The cookie follows the saved choice, so server code that only has the
  // request (the sign-in mail, a passkey notice) speaks it as well.
  if (session?.user.language && languageFromCookie(request.headers.get("cookie")) !== language) {
    setCookie(LANGUAGE_COOKIE, language, {
      path: "/",
      maxAge: LANGUAGE_COOKIE_MAX_AGE,
      sameSite: "lax",
      secure: new URL(request.url).protocol === "https:",
    });
  }
  return { session, language };
});

export type SessionData = Awaited<ReturnType<typeof getRootContext>>["session"];
