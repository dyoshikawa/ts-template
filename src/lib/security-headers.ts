/**
 * Response headers every page and API answer carries. The static assets
 * (`/assets/*`, icons, the service worker) are served by Cloudflare before
 * the Worker runs and do not get them, which is fine: they are public files.
 *
 * No Content-Security-Policy yet: the SSR hydration script is inline and
 * Turnstile loads a script and an iframe from challenges.cloudflare.com, so
 * a useful policy needs nonces wired through the framework first.
 */
const SECURITY_HEADERS: Record<string, string> = {
  // Browsers must trust the declared type: an upload served as image/png stays an image.
  "X-Content-Type-Options": "nosniff",
  // The app is never meant to be framed (clickjacking).
  "Content-Security-Policy": "frame-ancestors 'none'",
  "X-Frame-Options": "DENY",
  // Only the origin leaks to other sites (e.g. the JMA link on the weather page).
  "Referrer-Policy": "strict-origin-when-cross-origin",
  // The app uses none of these; the photo picker is a plain file input.
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  // A year of HTTPS-only for the custom domain and its subdomains.
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
};

/** The response with the security headers added (a copy: streamed responses have frozen headers). */
export function withSecurityHeaders(response: Response): Response {
  const copy = new Response(response.body, response);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    copy.headers.set(name, value);
  }
  return copy;
}
