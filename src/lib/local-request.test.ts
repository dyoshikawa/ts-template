import { describe, expect, it } from "vitest";

import { isLocalRequest } from "./local-request";

describe("isLocalRequest", () => {
  it("is true for a local hostname or a loopback client", () => {
    expect(isLocalRequest(new Request("http://localhost:4173/"))).toBe(true);
    expect(isLocalRequest(new Request("http://127.0.0.1:5173/"))).toBe(true);
    // The emulator rewrites the URL to the custom domain but the client is loopback.
    expect(
      isLocalRequest(
        new Request("http://app.example.com/", {
          headers: { "CF-Connecting-IP": "127.0.0.1" },
        }),
      ),
    ).toBe(true);
  });

  it("is false for a request that reached the edge", () => {
    expect(
      isLocalRequest(
        new Request("https://app.example.com/", {
          headers: { "CF-Connecting-IP": "203.0.113.5" },
        }),
      ),
    ).toBe(false);
    expect(isLocalRequest(new Request("https://app.example.com/"))).toBe(false);
  });
});
