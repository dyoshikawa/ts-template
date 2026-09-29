/**
 * Response headers every page and API answer carries. The static assets
 * (`/assets/*`, icons, the service worker, the offline page) are served by
 * Cloudflare before the Worker runs and do not get them, which is fine: they
 * are public files.
 */
const SECURITY_HEADERS: Record<string, string> = {
  // Browsers must trust the declared type: an upload served as image/png stays an image.
  "X-Content-Type-Options": "nosniff",
  // The app is never meant to be framed (clickjacking); `frame-ancestors` in the CSP says the same.
  "X-Frame-Options": "DENY",
  // Only the origin leaks to other sites.
  "Referrer-Policy": "strict-origin-when-cross-origin",
  // The app uses none of these.
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  // A year of HTTPS-only for the custom domain and its subdomains.
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
};

/** Turnstile's script and challenge iframe (src/components/turnstile.tsx). */
const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";

/**
 * The Content-Security-Policy for one response. Scripts run only with this
 * response's `nonce` — TanStack Start puts it on every script it renders
 * (`ssr.nonce` in src/router.tsx) — and, through `'strict-dynamic'`, the
 * scripts those load (the route chunks, Turnstile's script). The host and
 * `'self'` entries are the fallback for browsers without `'strict-dynamic'`.
 *
 * Styles allow `'unsafe-inline'`: React's `style` attributes and the
 * Turnstile widget set inline styles, and injected CSS cannot run code.
 *
 * Loading anything from another origin (an image CDN, an analytics script, an
 * API called from the browser) needs that origin added here.
 */
export function contentSecurityPolicy({ nonce }: { nonce: string }): string {
  return [
    "default-src 'self'",
    `script-src 'nonce-${nonce}' 'strict-dynamic' 'self' ${TURNSTILE_ORIGIN}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    `frame-src ${TURNSTILE_ORIGIN}`,
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

/** A fresh nonce for one response: 128 random bits, base64. */
export function createNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCodePoint(...bytes));
}

/**
 * The response with the security headers added (a copy: streamed responses
 * have frozen headers). With a `nonce` the Content-Security-Policy is set too;
 * without one (`vite dev`, whose inline scripts carry no nonce) only
 * `frame-ancestors` is.
 */
export function withSecurityHeaders(response: Response, { nonce }: { nonce?: string } = {}) {
  const copy = new Response(response.body, response);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    copy.headers.set(name, value);
  }
  copy.headers.set(
    "Content-Security-Policy",
    nonce === undefined ? "frame-ancestors 'none'" : contentSecurityPolicy({ nonce }),
  );
  return copy;
}
