import { ja, type Messages } from "./ja";
import { type Language } from "./language";

export type { Messages } from "./ja";

/**
 * The catalogues the pages read, by language. Japanese (the default) comes
 * with the app; English is a chunk of its own, loaded on demand
 * (`loadMessages`), so a page in Japanese does not ship it. The root route
 * loads the page's language before anything renders in it, the router
 * before it hydrates, and the language switch before it switches; until
 * then — or when the chunk cannot be fetched — the Japanese text stands in.
 * Server code writing mails and notifications reads ./all-messages.ts,
 * which has both at hand.
 */
const catalogues: Partial<Record<Language, Messages>> = { ja };
const listeners = new Set<() => void>();

/** The app's text in `language`, once loaded (the Japanese text until then). */
export function messagesFor(language: Language): Messages {
  return catalogues[language] ?? ja;
}

/** Loads `language`'s catalogue for `messagesFor`; a no-op once it is there. */
export async function loadMessages(language: Language): Promise<void> {
  if (catalogues[language] !== undefined) {
    return;
  }
  catalogues.en = (await import("./en")).en;
  for (const listener of listeners) {
    listener();
  }
}

/** Calls `listener` whenever a catalogue arrives (for `I18nProvider`). */
export function subscribeCatalogues(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
