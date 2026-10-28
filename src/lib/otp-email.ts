import { formatOtp } from "./otp-code";

/** A mail the app sends: subject plus plain-text and HTML bodies. */
export type OtpEmail = {
  subject: string;
  text: string;
  html: string;
};

export function buildOtpEmail({
  appName,
  otp,
  expiresInMinutes,
}: {
  appName: string;
  otp: string;
  expiresInMinutes: number;
}): OtpEmail {
  const code = formatOtp(otp);
  const subject = `${code} is your ${appName} sign-in code`;
  const text = [
    `Your ${appName} sign-in code is:`,
    "",
    code,
    "",
    `The code expires in ${expiresInMinutes} minutes.`,
    "If you did not ask for it, you can ignore this email.",
  ].join("\n");
  const html = [
    `<p>Your ${escapeHtml(appName)} sign-in code is:</p>`,
    `<p style="font-size:24px;font-weight:bold;letter-spacing:0.2em">${escapeHtml(code)}</p>`,
    `<p>The code expires in ${expiresInMinutes} minutes.</p>`,
    "<p>If you did not ask for it, you can ignore this email.</p>",
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
