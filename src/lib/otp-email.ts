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
  const subject = `${otp} is your ${appName} sign-in code`;
  const text = [
    `Your ${appName} sign-in code is:`,
    "",
    otp,
    "",
    `The code expires in ${expiresInMinutes} minutes.`,
    "If you did not ask for it, you can ignore this email.",
  ].join("\n");
  const html = [
    `<p>Your ${escapeHtml(appName)} sign-in code is:</p>`,
    `<p style="font-size:24px;font-weight:bold;letter-spacing:0.2em">${escapeHtml(otp)}</p>`,
    `<p>The code expires in ${expiresInMinutes} minutes.</p>`,
    "<p>If you did not ask for it, you can ignore this email.</p>",
  ].join("\n");

  return { subject, text, html };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
