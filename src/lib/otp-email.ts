import { type Language } from "../i18n/language";
import { messagesFor } from "../i18n/messages";
import { formatOtp } from "./otp-code";

/** A mail the app sends: subject plus plain-text and HTML bodies. */
export type OtpEmail = {
  subject: string;
  text: string;
  html: string;
};

/** The sign-in code mail, in `language` (the page's that asked for it). */
export function buildOtpEmail({
  appName,
  otp,
  expiresInMinutes,
  language,
}: {
  appName: string;
  otp: string;
  expiresInMinutes: number;
  language: Language;
}): OtpEmail {
  const t = messagesFor(language).email.otp;
  const code = formatOtp(otp);
  const subject = t.subject({ code, app: appName });
  const text = [
    t.intro({ app: appName }),
    "",
    code,
    "",
    t.expires({ minutes: expiresInMinutes }),
    t.ignore,
  ].join("\n");
  const html = [
    `<p>${escapeHtml(t.intro({ app: appName }))}</p>`,
    `<p style="font-size:24px;font-weight:bold;letter-spacing:0.2em">${escapeHtml(code)}</p>`,
    `<p>${escapeHtml(t.expires({ minutes: expiresInMinutes }))}</p>`,
    `<p>${escapeHtml(t.ignore)}</p>`,
  ].join("\n");

  return { subject, text, html };
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
