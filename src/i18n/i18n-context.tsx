import { useRouter } from "@tanstack/react-router";
import { createContext, type ReactNode, use, useCallback, useMemo, useState } from "react";

import { setLanguagePreference } from "../lib/language-functions";
import { type Language, localeOf } from "./language";
import { type Messages, messagesFor } from "./messages";

type I18n = {
  language: Language;
  /** The active language's text (`src/i18n/messages.ts`). */
  t: Messages;
  /** The `Intl` locale, for dates and numbers. */
  locale: string;
  /**
   * Switches the language at once and saves the choice; resolves false
   * (back to the previous language) when it could not be saved.
   */
  setLanguage: (language: Language) => Promise<boolean>;
};

const I18nContext = createContext<I18n | null>(null);

/**
 * Provides the language resolved on the server for this request (root
 * context). Per request on purpose: renders of two requests interleave on
 * the server, so a module-level "current language" would leak between them.
 */
export function I18nProvider({
  language: resolved,
  children,
}: {
  language: Language;
  children: ReactNode;
}) {
  const router = useRouter();
  // A switch shows at once; it holds until the server's answer catches up.
  const [override, setOverride] = useState<{ over: Language; to: Language } | null>(null);
  const language = override && override.over === resolved ? override.to : resolved;

  const setLanguage = useCallback(
    async (next: Language) => {
      setOverride({ over: resolved, to: next });
      try {
        await setLanguagePreference({ data: { language: next } });
        await router.invalidate();
        return true;
      } catch {
        setOverride(null);
        return false;
      }
    },
    [resolved, router],
  );

  const value = useMemo(
    () => ({ language, t: messagesFor(language), locale: localeOf(language), setLanguage }),
    [language, setLanguage],
  );
  return <I18nContext value={value}>{children}</I18nContext>;
}

/**
 * Outside a provider (a component rendered on its own in a unit test) the
 * text is Japanese and switching does nothing.
 */
const STANDALONE: I18n = {
  language: "ja",
  t: messagesFor("ja"),
  locale: localeOf("ja"),
  setLanguage: async () => false,
};

export function useI18n(): I18n {
  return use(I18nContext) ?? STANDALONE;
}
