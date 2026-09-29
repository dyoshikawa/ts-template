import { describe, expect, it } from "vitest";

import { contentSecurityPolicy, createNonce, withSecurityHeaders } from "./security-headers";

describe("withSecurityHeaders", () => {
  it("adds the headers and keeps the status, body and existing headers", async () => {
    const response = withSecurityHeaders(
      new Response("<p>hi</p>", { status: 201, headers: { "Content-Type": "text/html" } }),
      { nonce: "abc" },
    );
    expect(response.status).toBe(201);
    expect(response.headers.get("Content-Type")).toBe("text/html");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("X-Frame-Options")).toBe("DENY");
    expect(response.headers.get("Strict-Transport-Security")).toContain("max-age=31536000");
    expect(response.headers.get("Content-Security-Policy")).toBe(
      contentSecurityPolicy({ nonce: "abc" }),
    );
    await expect(response.text()).resolves.toBe("<p>hi</p>");
  });

  it("only forbids framing when there is no nonce (vite dev)", () => {
    const response = withSecurityHeaders(new Response(""));
    expect(response.headers.get("Content-Security-Policy")).toBe("frame-ancestors 'none'");
  });
});

describe("contentSecurityPolicy", () => {
  it("runs only scripts with the nonce and the ones they load", () => {
    const policy = contentSecurityPolicy({ nonce: "abc" });
    expect(policy).toContain("script-src 'nonce-abc' 'strict-dynamic'");
    expect(policy).not.toMatch(/script-src[^;]*'unsafe-inline'/u);
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("base-uri 'none'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("frame-src https://challenges.cloudflare.com");
  });
});

describe("createNonce", () => {
  it("draws 128 random bits each time", () => {
    const first = createNonce();
    expect(atob(first)).toHaveLength(16);
    expect(createNonce()).not.toBe(first);
  });
});
