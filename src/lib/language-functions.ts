import { createServerFn } from "@tanstack/react-start";
import { getRequest, setCookie } from "@tanstack/react-start/server";
import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import * as z from "zod/mini";

import { createDb } from "../db/client";
import * as schema from "../db/schema";
import { LANGUAGE_COOKIE, LANGUAGE_COOKIE_MAX_AGE, LANGUAGES } from "../i18n/language";
import { createAuth } from "./auth";
import { refreshSessionCache } from "./auth-server";

/**
 * Remembers the language the user picked: in a cookie (for this browser,
 * signed in or not) and, when signed in, on the user row, so every device
 * they sign in on follows it. The session cookie caches the user, so it is
 * refreshed right away.
 */
export const setLanguagePreference = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ language: z.enum(LANGUAGES) }).parse(input))
  .handler(async ({ data }) => {
    const request = getRequest();
    setCookie(LANGUAGE_COOKIE, data.language, {
      path: "/",
      maxAge: LANGUAGE_COOKIE_MAX_AGE,
      sameSite: "lax",
      secure: new URL(request.url).protocol === "https:",
    });
    const session = await createAuth({ request }).api.getSession({ headers: request.headers });
    if (!session) {
      return;
    }
    await createDb({ d1: env.DB })
      .update(schema.user)
      .set({ language: data.language })
      .where(eq(schema.user.id, session.user.id));
    await refreshSessionCache();
  });
