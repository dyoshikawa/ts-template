import { escapeHtml, type OtpEmail } from "./otp-email";

/**
 * The notice mailed when a passkey is added to an account, so a passkey the
 * user did not add themselves (someone with their unlocked session) does not
 * go unnoticed. It holds nothing that signs anyone in.
 */
export function buildPasskeyAddedEmail({
  appName,
  passkeyName,
  accountUrl,
}: {
  appName: string;
  passkeyName: string;
  accountUrl: string;
}): OtpEmail {
  const subject = `A passkey was added to your ${appName} account`;
  const text = [
    `A new passkey, "${passkeyName}", was added to your ${appName} account.`,
    "",
    "If you did not add it, delete it from your account page right away:",
    accountUrl,
  ].join("\n");
  const html = [
    `<p>A new passkey, "${escapeHtml(passkeyName)}", was added to your ${escapeHtml(appName)} account.</p>`,
    `<p>If you did not add it, delete it from your <a href="${escapeHtml(accountUrl)}">account page</a> right away.</p>`,
  ].join("\n");

  return { subject, text, html };
}
