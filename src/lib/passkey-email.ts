import { allMessagesFor } from "../i18n/all-messages";
import { type Language } from "../i18n/language";
import { escapeHtml, type OtpEmail } from "./otp-email";

/**
 * The notice mailed when a passkey is added to an account, so a passkey the
 * user did not add themselves (someone with their unlocked session) does not
 * go unnoticed. It holds nothing that signs anyone in. In `language`, the
 * account's.
 */
export function buildPasskeyAddedEmail({
  appName,
  passkeyName,
  accountUrl,
  language,
}: {
  appName: string;
  passkeyName: string;
  accountUrl: string;
  language: Language;
}): OtpEmail {
  const t = allMessagesFor(language).email.passkeyAdded;
  const subject = t.subject({ app: appName });
  const text = [t.body({ name: passkeyName, app: appName }), "", t.warning, accountUrl].join("\n");
  const html = [
    `<p>${escapeHtml(t.body({ name: passkeyName, app: appName }))}</p>`,
    `<p>${escapeHtml(t.warningBefore)}<a href="${escapeHtml(accountUrl)}">${escapeHtml(t.accountPage)}</a>${escapeHtml(t.warningAfter)}</p>`,
  ].join("\n");

  return { subject, text, html };
}
