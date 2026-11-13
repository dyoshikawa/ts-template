/** The error `code` of a request that never reached the server. */
export const UNREACHABLE = "UNREACHABLE";

/**
 * Stands in for the answer to a request that could not be sent at all, so
 * Better Auth's client reports it like a refusal (`error.code` is
 * {@link UNREACHABLE}) rather than throwing. A real response cannot carry
 * status 0; 503 is the nearest, and the code tells it apart from a server's.
 */
function unreachableResponse(): Response {
  return new Response(
    JSON.stringify({ code: UNREACHABLE, message: "The server could not be reached" }),
    { status: 503, statusText: "Unreachable", headers: { "content-type": "application/json" } },
  );
}

/**
 * A 429 answer with its `X-Retry-After` header (seconds, Better Auth's rate
 * limiter; or a standard `Retry-After` in seconds) copied into the JSON body as `retryAfter`, where Better Auth's
 * client error carries it (the client passes no headers on); any other
 * answer as it came.
 */
async function withRetryAfter(response: Response): Promise<Response> {
  // Better Auth's own header, else the standard one (a proxy's or WAF's limit).
  const retryAfter = response.headers.get("X-Retry-After") ?? response.headers.get("Retry-After");
  if (response.status !== 429 || retryAfter === null) {
    return response;
  }
  let body: unknown = null;
  try {
    body = await response.clone().json();
  } catch {
    // Not JSON: only the wait is kept.
  }
  const fields = typeof body === "object" && body !== null ? body : {};
  const seconds = Number(retryAfter);
  if (!Number.isFinite(seconds) || seconds < 0) {
    // An HTTP date or junk: the message then says only to wait a moment.
    return response;
  }
  return new Response(JSON.stringify({ ...fields, retryAfter: seconds }), {
    status: response.status,
    statusText: response.statusText,
    headers: { "content-type": "application/json" },
  });
}

/**
 * `fetch` for Better Auth's client: a request that never reaches the server
 * (offline, a dropped connection) comes back as {@link unreachableResponse}
 * instead of a rejected promise, which every caller of the client would
 * leave spinning (the client throws on it even with `throw: false`); a rate
 * limit's wait goes into the error as `retryAfter` ({@link withRetryAfter}).
 */
export const fetchOrUnreachable: typeof fetch = async (input, init) => {
  let response: Response;
  try {
    response = await fetch(input, init);
  } catch (error) {
    // A request the page cancelled itself (a passkey prompt replaced by
    // another) or gave a deadline is not "unreachable": the caller handles
    // the abort, and a timeout is told apart by its name (src/lib/failure.ts).
    if (
      error instanceof DOMException &&
      (error.name === "AbortError" || error.name === "TimeoutError")
    ) {
      throw error;
    }
    return unreachableResponse();
  }
  return withRetryAfter(response);
};
