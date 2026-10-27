/** What a passkey is called when it has no label of its own. */
export const PASSKEY_LABEL = "Passkey";

/** A stored passkey's label for display. */
export function passkeyLabel({ name }: { name: string | null }): string {
  return name ?? PASSKEY_LABEL;
}

/** Longest label stored for a passkey. */
const MAX_NAME_LENGTH = 100;

/**
 * The label a new passkey is listed under, so the user can tell their
 * passkeys apart: the password manager that holds it when the authenticator
 * is known by its AAGUID (`provider`), and the device and browser it was
 * made on, read from the user agent. Apple devices report no AAGUID, so the
 * device part is often all there is.
 */
export function passkeyName({
  provider,
  userAgent,
}: {
  provider: string | undefined;
  userAgent: string | null;
}): string {
  const device = describeUserAgent(userAgent ?? "");
  const name = provider
    ? device
      ? `${provider} (${device})`
      : provider
    : (device ?? PASSKEY_LABEL);
  return name.slice(0, MAX_NAME_LENGTH);
}

const PLATFORMS: Array<[RegExp, string]> = [
  [/iPhone/, "iPhone"],
  [/iPad/, "iPad"],
  [/Android/, "Android"],
  [/CrOS/, "ChromeOS"],
  [/Windows/, "Windows"],
  [/Macintosh|Mac OS X/, "Mac"],
  [/Linux/, "Linux"],
];

// Order matters: Edge and Opera also say "Chrome", Chrome also says "Safari".
const BROWSERS: Array<[RegExp, string]> = [
  [/EdgiOS|EdgA?\//, "Edge"],
  [/OPR\/|OPiOS/, "Opera"],
  [/SamsungBrowser/, "Samsung Internet"],
  [/FxiOS|Firefox\//, "Firefox"],
  [/CriOS|Chrome\//, "Chrome"],
  [/Safari\//, "Safari"],
];

/** "Safari on iPhone", "Chrome on Windows"…; `undefined` when nothing is recognized. */
function describeUserAgent(userAgent: string): string | undefined {
  const platform = PLATFORMS.find(([pattern]) => pattern.test(userAgent))?.[1];
  const browser = BROWSERS.find(([pattern]) => pattern.test(userAgent))?.[1];
  if (platform && browser) {
    return `${browser} on ${platform}`;
  }
  return platform ?? browser;
}
