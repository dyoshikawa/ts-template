import { notFound } from "@tanstack/react-router";
import { describe, expect, it } from "vite-plus/test";

import { en } from "../i18n/en";
import { ja } from "../i18n/ja";
import { classifyFailure, failureNotice, failureText } from "./failure";
import { UNREACHABLE } from "./unreachable";

const NOW = Date.UTC(2026, 10, 6, 12, 0, 0);

describe("classifyFailure", () => {
  it("reads a thrown Response's status, and a rate limit's wait from its header", () => {
    expect(classifyFailure(new Response(null, { status: 401 }))).toEqual({ kind: "signedOut" });
    expect(classifyFailure(new Response(null, { status: 403 }))).toEqual({ kind: "forbidden" });
    expect(classifyFailure(new Response(null, { status: 404 }))).toEqual({ kind: "notFound" });
    expect(classifyFailure(new Response(null, { status: 400 }))).toEqual({
      kind: "refused",
      status: 400,
    });
    expect(classifyFailure(new Response(null, { status: 503 }))).toEqual({
      kind: "server",
      status: 503,
    });
    expect(
      classifyFailure(new Response(null, { status: 429, headers: { "Retry-After": "90" } }), {
        now: NOW,
      }),
    ).toEqual({ kind: "rateLimited", retryAt: NOW + 90_000 });
  });

  it("reads Better Auth's error, its UNREACHABLE code and its retryAfter", () => {
    expect(classifyFailure({ status: 503, code: UNREACHABLE })).toEqual({ kind: "offline" });
    expect(classifyFailure({ status: 429, retryAfter: 30 }, { now: NOW })).toEqual({
      kind: "rateLimited",
      retryAt: NOW + 30_000,
    });
    expect(classifyFailure({ status: 429 })).toEqual({ kind: "rateLimited", retryAt: null });
    expect(classifyFailure({ status: 500, code: "X" })).toEqual({ kind: "server", status: 500 });
  });

  it("tells a fetch that never left from a bug by the message, not by TypeError", () => {
    expect(classifyFailure(new TypeError("Failed to fetch"))).toEqual({ kind: "offline" });
    expect(classifyFailure(new TypeError("Load failed"))).toEqual({ kind: "offline" });
    expect(
      classifyFailure(new TypeError("NetworkError when attempting to fetch resource.")),
    ).toEqual({ kind: "offline" });
    expect(
      classifyFailure(new TypeError("Cannot read properties of undefined (reading 'x')")),
    ).toEqual({ kind: "unexpected" });
  });

  it("takes a plain Error for the server's (a server function's failure without a status)", () => {
    expect(classifyFailure(new Error("boom"))).toEqual({ kind: "server", status: null });
  });

  it("knows a timeout and the router's notFound", () => {
    expect(classifyFailure(new DOMException("slow", "TimeoutError"))).toEqual({ kind: "timeout" });
    expect(classifyFailure(notFound())).toEqual({ kind: "notFound" });
    expect(classifyFailure("??")).toEqual({ kind: "unexpected" });
  });
});

describe("classifyFailure while the browser says it is offline", () => {
  it("keeps a status the server answered with, and calls the rest offline", () => {
    const onLine = Object.getOwnPropertyDescriptor(Navigator.prototype, "onLine");
    Object.defineProperty(Navigator.prototype, "onLine", { configurable: true, get: () => false });
    try {
      expect(classifyFailure(new Response(null, { status: 401 }))).toEqual({ kind: "signedOut" });
      expect(classifyFailure(new Error("boom"))).toEqual({ kind: "offline" });
    } finally {
      if (onLine) {
        Object.defineProperty(Navigator.prototype, "onLine", onLine);
      }
    }
  });
});

describe("failureText", () => {
  it("names the reset time of a rate limit in the page's language, rounded up", () => {
    const failure = { kind: "rateLimited", retryAt: Date.UTC(2026, 10, 6, 3, 4, 10) } as const;
    const text = failureText({ failure, t: en, locale: "en-US" });
    const expected = new Intl.DateTimeFormat("en-US", { timeStyle: "short" }).format(
      Date.UTC(2026, 10, 6, 3, 5, 0),
    );
    expect(text).toBe(en.failure.rateLimitedUntil({ time: expected }));
  });

  it("gives every kind its own sentence", () => {
    const kinds = [
      { kind: "offline" },
      { kind: "timeout" },
      { kind: "rateLimited", retryAt: null },
      { kind: "signedOut" },
      { kind: "forbidden" },
      { kind: "notFound" },
      { kind: "refused", status: 400 },
      { kind: "server", status: 500 },
      { kind: "server", status: null },
      { kind: "unexpected" },
    ] as const;
    const texts = kinds.map((failure) => failureText({ failure, t: ja, locale: "ja-JP" }));
    expect(new Set(texts).size).toBe(kinds.length);
  });
});

describe("failureNotice", () => {
  it("puts the action first and the kind after it", () => {
    expect(
      failureNotice({
        action: en.passkeys.deleteFailed,
        error: new Response(null, { status: 401 }),
        t: en,
        locale: "en-US",
      }),
    ).toBe(`${en.passkeys.deleteFailed} ${en.failure.signedOut}`);
    expect(
      failureNotice({
        action: ja.passkeys.deleteFailed,
        error: { status: 503, code: UNREACHABLE },
        t: ja,
        locale: "ja-JP",
      }),
    ).toBe(`${ja.passkeys.deleteFailed}${ja.failure.offline}`);
  });
});
