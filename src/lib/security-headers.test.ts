import { describe, expect, it } from "vitest";

import { withSecurityHeaders } from "./security-headers";

describe("withSecurityHeaders", () => {
  it("adds the headers and keeps the status, body and existing headers", async () => {
    const response = withSecurityHeaders(
      new Response("<p>hi</p>", { status: 201, headers: { "Content-Type": "text/html" } }),
    );
    expect(response.status).toBe(201);
    expect(response.headers.get("Content-Type")).toBe("text/html");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Content-Security-Policy")).toBe("frame-ancestors 'none'");
    expect(response.headers.get("X-Frame-Options")).toBe("DENY");
    expect(response.headers.get("Strict-Transport-Security")).toContain("max-age=31536000");
    await expect(response.text()).resolves.toBe("<p>hi</p>");
  });
});
