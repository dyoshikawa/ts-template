import { APP_NAME } from "../lib/app";
import { type Language } from "./language";
import { type Messages, messagesFor } from "./messages";

/**
 * A route's `<title>` in the request's language, e.g. `アカウント — ts-template`:
 * `head: ({ match }) => ({ meta: [{ title: pageTitle({ language: match.context.language, page: (t) => t.auth.accountTitle }) }] })`.
 */
export function pageTitle({
  language,
  page,
}: {
  language: Language;
  page: (t: Messages) => string;
}): string {
  const t = messagesFor(language);
  return t.common.pageTitle({ page: page(t), app: APP_NAME });
}
