import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const getSession = vi.fn();
const createAuth = vi.fn(() => ({ api: { getSession } }));
vi.mock("./auth", () => ({ createAuth }));

const signedIn = () =>
  new Request("https://app.example.com/", {
    headers: { cookie: "__Host-better-auth.session_token=token.signature" },
  });

let current = signedIn();
vi.mock("@tanstack/react-start/server", () => ({ getRequest: () => current }));

const { readSession, requireUserId } = await import("./auth-server");

beforeEach(() => {
  createAuth.mockClear();
  getSession.mockReset();
  getSession.mockResolvedValue({ user: { id: "user-1" } });
});

describe("readSession", () => {
  it("looks the session up once per request, however many server functions ask", async () => {
    // A page rendered on the server runs the root's session read and each
    // loader's server function against the same Request.
    current = signedIn();
    await Promise.all([readSession(), requireUserId(), requireUserId()]);
    expect(createAuth).toHaveBeenCalledTimes(1);
    expect(getSession).toHaveBeenCalledTimes(1);

    current = signedIn();
    expect(await requireUserId()).toBe("user-1");
    expect(getSession).toHaveBeenCalledTimes(2);
  });

  it("answers null without building Better Auth when there is no session cookie", async () => {
    current = new Request("https://app.example.com/", { headers: { cookie: "lang=ja" } });
    expect(await readSession()).toBeNull();
    await expect(requireUserId()).rejects.toBeInstanceOf(Response);
    expect(createAuth).not.toHaveBeenCalled();
  });

  it("refuses a request without a session", async () => {
    current = signedIn();
    getSession.mockResolvedValue(null);
    await expect(requireUserId()).rejects.toBeInstanceOf(Response);
  });
});

/**
 * Better Auth is about 1 MB of the Worker's code. The route tree (server
 * routes included) and the server functions a signed-out page calls are
 * loaded by every page, so they import it only inside the handlers that need
 * it; a static import would put it back on every cold start.
 */
describe("Better Auth on a cold start", () => {
  it("is imported on demand by the server routes and the server-function files", () => {
    for (const file of [
      "lib/auth-server.ts",
      "lib/auth-functions.ts",
      "lib/account-functions.ts",
      "lib/language-functions.ts",
      "lib/push-functions.ts",
      "routes/api/auth/$.ts",
      "routes/api/push/subscription.ts",
    ]) {
      const source = readFileSync(join(import.meta.dirname, "..", file), "utf8");
      // `import { type … }` counts too: it stays in the output as a bare import.
      expect(source, file).not.toMatch(/from "(?:\.\.\/)*(?:\.\/|lib\/)auth"/u);
    }
  });
});
