import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { fetchOrUnreachable, UNREACHABLE } from "./unreachable";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchOrUnreachable", () => {
  it("answers a request that never left with the UNREACHABLE code instead of throwing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const response = await fetchOrUnreachable("/api/auth/sign-out", { method: "POST" });
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: UNREACHABLE });
  });

  it("passes on an abort the page asked for", async () => {
    const abort = new DOMException("The operation was aborted.", "AbortError");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(abort));
    await expect(fetchOrUnreachable("/api/auth/sign-out")).rejects.toBe(abort);
  });

  it("copies a rate limit's X-Retry-After into the body as retryAfter", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: "Too many requests." }), {
          status: 429,
          headers: { "X-Retry-After": "42" },
        }),
      ),
    );
    const response = await fetchOrUnreachable("/api/auth/sign-in/passkey");
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ message: "Too many requests.", retryAfter: 42 });
  });

  it("keeps a 429 without the header, and every other answer, as it came", async () => {
    const plain = new Response("slow down", { status: 429 });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(plain));
    expect(await fetchOrUnreachable("/x")).toBe(plain);
  });
});

describe("fetchOrUnreachable's edges", () => {
  it("passes on a deadline's TimeoutError", async () => {
    const timeout = new DOMException("The operation timed out.", "TimeoutError");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(timeout));
    await expect(fetchOrUnreachable("/x")).rejects.toBe(timeout);
  });

  it("reads a standard Retry-After in seconds, and ignores a date", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(new Response("{}", { status: 429, headers: { "Retry-After": "7" } })),
    );
    expect(await (await fetchOrUnreachable("/x")).json()).toEqual({ retryAfter: 7 });
    const dated = new Response("{}", {
      status: 429,
      headers: { "Retry-After": "Wed, 21 Oct 2026 07:28:00 GMT" },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(dated));
    expect(await fetchOrUnreachable("/x")).toBe(dated);
  });
});
