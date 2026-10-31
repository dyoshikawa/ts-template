import { en } from "./en";
import { ja } from "./ja";
import { type Language } from "./language";

/** The shape of a catalogue: the Japanese one's, which the English one must match. */
export type Messages = typeof ja;

/** The app's text in `language`. */
export function messagesFor(language: Language): Messages {
  return language === "en" ? en : ja;
}
