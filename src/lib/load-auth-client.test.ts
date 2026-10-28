import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.doUnmock("./auth-client");
  vi.resetModules();
});

describe("loadAuthClient", () => {
  it("resolves to null when the chunk cannot be fetched, and tries again later", async () => {
    vi.doMock("./auth-client", () => {
      throw new Error("Failed to fetch dynamically imported module");
    });
    const { loadAuthClient } = await import("./load-auth-client");
    await expect(loadAuthClient()).resolves.toBeNull();

    vi.doUnmock("./auth-client");
    vi.doMock("./auth-client", () => ({ authClient: { signOut: () => {} } }));
    await expect(loadAuthClient()).resolves.toMatchObject({ signOut: expect.any(Function) });
  });
});
