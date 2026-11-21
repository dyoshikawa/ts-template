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

  it("does not keep a failed lookup", async () => {
    current = signedIn();
    getSession.mockRejectedValueOnce(new Error("D1 unavailable"));
    await expect(readSession()).rejects.toThrow("D1 unavailable");
    expect(await requireUserId()).toBe("user-1");
    expect(getSession).toHaveBeenCalledTimes(2);
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

/**
 * Drizzle and the schema (about 150 KB of the Worker's code) are needed only
 * by requests that touch the database. The Worker's entry is evaluated on
 * every cold start, the route tree (server routes included) and the sign-in
 * page's server functions are loaded by every signed-out page, so they reach
 * the database code only inside the handlers that need it.
 */
describe("Drizzle on a cold start", () => {
  it("is imported on demand by the entry, the server routes and the public server functions", () => {
    for (const file of [
      "server.ts",
      "lib/auth-server.ts",
      "lib/auth-functions.ts",
      "lib/public-config-functions.ts",
      "lib/push-subscription.ts",
      "routes/api/auth/$.ts",
      "routes/api/push/subscription.ts",
    ]) {
      const source = readFileSync(join(import.meta.dirname, "..", file), "utf8");
      // Drizzle itself, the database modules, and the server-function files
      // and libraries that import them (static imports, side-effect ones too).
      expect(source, file).not.toMatch(
        /(?:from |import )"(?:drizzle-orm|(?:\.\.?\/)+(?:db\/|lib\/)?(?:client|schema|auth|push|push-functions|account-functions|language-functions|verification-cleanup)(?:\.ts)?")/u,
      );
    }
  });

  it("is not reached by the loaders of the pages a signed-out visitor opens", () => {
    // A server function called while a page renders loads its file's whole
    // handler chunk, so these routes call only the files kept free of it.
    const allowed = new Set(["auth-functions", "public-config-functions"]);
    for (const file of ["routes/__root.tsx", "routes/index.tsx", "routes/login.tsx"]) {
      const source = readFileSync(join(import.meta.dirname, "..", file), "utf8");
      for (const [, name] of source.matchAll(/from "\.\.\/lib\/([\w-]+-functions)(?:\.ts)?"/gu)) {
        expect(allowed, `${file} imports ${name}`).toContain(name);
      }
    }
  });
});
