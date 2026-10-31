/** The languages the app speaks; Japanese is the one it was written in. */
export const LANGUAGES = ["ja", "en"] as const;

export type Language = (typeof LANGUAGES)[number];

/** Each language's name in itself, the way a switcher lists them. */
export const LANGUAGE_NAMES: Record<Language, string> = { ja: "日本語", en: "English" };

const DEFAULT_LANGUAGE: Language = "ja";

/** Where the choice is kept for a visitor who is not signed in (and on every device of one who is). */
export const LANGUAGE_COOKIE = "lang";

/** A year: the choice should outlive any session. */
export const LANGUAGE_COOKIE_MAX_AGE = 365 * 24 * 60 * 60;

function isLanguage(value: unknown): value is Language {
  return typeof value === "string" && (LANGUAGES as readonly string[]).includes(value);
}

/** The `Intl` locale for a language. */
export function localeOf(language: Language): string {
  return language === "ja" ? "ja-JP" : "en-US";
}

/**
 * The language a browser asks for: the first range of `Accept-Language`
 * (by quality) that is Japanese or English. Any `ja*` means Japanese and
 * anything else English, so a missing header falls back to Japanese only
 * when there is nothing to go on.
 */
export function languageFromAcceptLanguage(header: string | null | undefined): Language {
  if (!header) {
    return DEFAULT_LANGUAGE;
  }
  const ranges = header
    .split(",")
    .map((part, index) => {
      const [tag = "", ...params] = part.trim().split(";");
      const q = params.map((param) => param.trim()).find((param) => param.startsWith("q="));
      const quality = q ? Number(q.slice(2)) : 1;
      return { tag: tag.toLowerCase(), quality: Number.isFinite(quality) ? quality : 0, index };
    })
    .filter(({ tag, quality }) => tag !== "" && quality > 0)
    .toSorted((a, b) => b.quality - a.quality || a.index - b.index);
  const first = ranges[0];
  if (!first) {
    return DEFAULT_LANGUAGE;
  }
  return first.tag === "ja" || first.tag.startsWith("ja-") ? "ja" : "en";
}

/** The `lang` cookie's value from a `Cookie` header, when it names a language. */
export function languageFromCookie(header: string | null | undefined): Language | null {
  if (!header) {
    return null;
  }
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === LANGUAGE_COOKIE) {
      const value = decodeURIComponent(rest.join("="));
      return isLanguage(value) ? value : null;
    }
  }
  return null;
}

/**
 * The language to answer a request in: the user's saved choice, then the
 * cookie, then what the browser asks for.
 */
export function resolveLanguage({
  saved,
  cookieHeader,
  acceptLanguage,
}: {
  saved?: unknown;
  cookieHeader?: string | null;
  acceptLanguage?: string | null;
}): Language {
  if (isLanguage(saved)) {
    return saved;
  }
  return languageFromCookie(cookieHeader) ?? languageFromAcceptLanguage(acceptLanguage);
}

/** `resolveLanguage` for an incoming request (no saved choice: pass it when there is a user). */
export function requestLanguage({
  request,
  saved,
}: {
  request: Request;
  saved?: unknown;
}): Language {
  return resolveLanguage({
    saved,
    cookieHeader: request.headers.get("cookie"),
    acceptLanguage: request.headers.get("accept-language"),
  });
}
