import { en } from "./en";
import { ja, type Messages } from "./ja";
import { type Language } from "./language";

/**
 * The app's text in `language`, both catalogues always at hand: for server
 * code writing mails and notifications in the recipient's language. Pages
 * read ./messages.ts, which loads English only when it is needed.
 */
export function allMessagesFor(language: Language): Messages {
  return language === "en" ? en : ja;
}
