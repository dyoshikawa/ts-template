/**
 * Whether a request came in over a local address (`pnpm dev`, the emulator,
 * browser tests). The switches meant for local runs only — Turnstile off, a
 * fixed sign-in code — are honoured for such requests alone.
 *
 * The emulator rewrites the URL to the Worker's custom domain, so the
 * hostname alone is not enough; the client address is checked too. On the
 * edge Cloudflare sets `CF-Connecting-IP` itself (a client cannot supply
 * it) and a loopback address can never reach the edge, so a loopback
 * client means a local run.
 */
export function isLocalRequest(request: Request): boolean {
  const { hostname } = new URL(request.url);
  const client = request.headers.get("CF-Connecting-IP");
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]" ||
    client === "127.0.0.1" ||
    client === "::1"
  );
}
