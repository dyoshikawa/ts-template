// @vitest-environment node
import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { Route } from "../routes/api/auth/$";
import { createTestD1, type TestD1 } from "../test/d1-sqlite";
import { MAX_PASSKEYS_PER_USER } from "./auth-guard";
import { authEndpointPaths, isAuthEndpointRequest } from "./auth-paths";

/**
 * The `/api/auth/*` route driven end to end, as the Worker serves it, on an
 * in-memory D1 with the app's migrations. Kept apart from `auth.test.ts`,
 * whose cases need no database.
 */

const vars = env as unknown as Record<string, unknown>;
/** A local run: Turnstile can be switched off, the code is fixed, no rate limit. */
const LOCAL_ORIGIN = "http://localhost:4173";
/** A deployed hostname: the rate limiter is on and counts in D1. */
const DEPLOYED_ORIGIN = "https://app.example.com";
const EMAIL = "someone@example.test";
const CODE = "12345678";

let db: TestD1;

beforeEach(() => {
  // `vp dev`: no mail leaves, the code is logged instead.
  vi.stubEnv("DEV", true);
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  db = createTestD1();
  vars.DB = db.d1;
  vars.BETTER_AUTH_SECRET = "a-test-secret-that-is-long-enough-1234567890";
  vars.TURNSTILE_DISABLED = "1";
  vars.E2E_SIGN_IN_CODE = CODE;
});

afterEach(() => {
  for (const key of Object.keys(vars)) {
    delete vars[key];
  }
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

/** A browser's cookie jar: name → value, updated from each answer. */
type Jar = Map<string, string>;

const handlers = Route.options.server?.handlers as Record<
  "GET" | "POST",
  (context: { request: Request }) => Promise<Response>
>;

/** One request to the route: a GET without a body, a JSON POST with one. */
async function call({
  origin = LOCAL_ORIGIN,
  path,
  jar = new Map(),
  body,
}: {
  origin?: string;
  path: string;
  jar?: Jar;
  body?: unknown;
}): Promise<Response> {
  const headers = new Headers({ origin });
  if (jar.size > 0) {
    headers.set("cookie", [...jar].map(([name, value]) => `${name}=${value}`).join("; "));
  }
  const url = `${origin}/api/auth${path}`;
  let response: Response;
  if (body === undefined) {
    response = await handlers.GET({ request: new Request(url, { headers }) });
  } else {
    headers.set("content-type", "application/json");
    response = await handlers.POST({
      request: new Request(url, { method: "POST", headers, body: JSON.stringify(body) }),
    });
  }
  for (const cookie of response.headers.getSetCookie()) {
    const [pair = ""] = cookie.split(";");
    const index = pair.indexOf("=");
    const name = pair.slice(0, index).trim();
    const value = pair.slice(index + 1).trim();
    if (value === "" || /;\s*max-age=0\s*(;|$)/iu.test(cookie)) {
      jar.delete(name);
    } else {
      jar.set(name, value);
    }
  }
  return response;
}

async function signIn(): Promise<Jar> {
  const jar: Jar = new Map();
  const sent = await call({
    path: "/email-otp/send-verification-otp",
    jar,
    body: { email: EMAIL, type: "sign-in" },
  });
  expect(sent.status).toBe(200);
  const signedIn = await call({
    path: "/sign-in/email-otp",
    jar,
    body: { email: EMAIL, otp: CODE },
  });
  expect(signedIn.status).toBe(200);
  return jar;
}

function rateLimitRows(): number {
  return (db.sqlite.prepare("select count(*) as n from rate_limit").get() as { n: number }).n;
}

function addPasskey(id: string): void {
  const { id: userId } = db.sqlite.prepare("select id from user").get() as { id: string };
  db.sqlite
    .prepare(
      "insert into passkey (id, public_key, user_id, credential_id, counter, device_type, backed_up) values (?, 'key', ?, ?, 0, 'singleDevice', 0)",
    )
    .run(id, userId, `credential-${id}`);
}

describe("authEndpointPaths", () => {
  it("lists the endpoints that are on and take no path parameter", () => {
    const paths = authEndpointPaths({
      endpoints: {
        getSession: { path: "/get-session" },
        signInEmail: { path: "/sign-in/email" },
        resetPasswordCallback: { path: "/reset-password/:token" },
        helper: () => {},
      },
      disabled: ["/sign-in/email"],
    });
    expect([...paths]).toEqual(["/get-session"]);
  });
});

describe("isAuthEndpointRequest", () => {
  const paths = new Set(["/get-session"]);

  it("accepts an endpoint, with or without a trailing slash or a query", () => {
    const url = `${DEPLOYED_ORIGIN}/api/auth/get-session`;
    expect(isAuthEndpointRequest({ url, paths })).toBe(true);
    expect(isAuthEndpointRequest({ url: `${url}/`, paths })).toBe(true);
    expect(isAuthEndpointRequest({ url: `${url}?x=1`, paths })).toBe(true);
  });

  it("refuses a made-up path, a nested one or one outside the base path", () => {
    for (const path of ["/made-up", "//get-session", "/get-session/more"]) {
      expect(isAuthEndpointRequest({ url: `${DEPLOYED_ORIGIN}/api/auth${path}`, paths })).toBe(
        false,
      );
    }
    expect(isAuthEndpointRequest({ url: `${DEPLOYED_ORIGIN}/api/authority`, paths })).toBe(false);
  });
});

/** The endpoints Better Auth serves on GET; the rest take a POST. */
const GET_ENDPOINTS = new Set([
  "/get-session",
  "/list-sessions",
  "/passkey/generate-register-options",
  "/passkey/generate-authenticate-options",
  "/passkey/list-user-passkeys",
]);

describe("the /api/auth route", () => {
  it("serves every endpoint the app calls", async () => {
    for (const path of [
      "/get-session",
      "/sign-out",
      "/update-user",
      "/list-sessions",
      "/email-otp/send-verification-otp",
      "/sign-in/email-otp",
      "/passkey/generate-register-options",
      "/passkey/verify-registration",
      "/passkey/generate-authenticate-options",
      "/passkey/verify-authentication",
      "/passkey/list-user-passkeys",
      "/passkey/delete-passkey",
    ]) {
      const body = GET_ENDPOINTS.has(path) ? undefined : {};
      const response = await call({ path, body });
      expect(response.status, path).not.toBe(404);
    }
  });

  it("answers a path that is no endpoint without counting it", async () => {
    const before = rateLimitRows();
    for (const path of ["/made-up-1", "/made-up-2", "/reset-password/abc", "/sign-in/email"]) {
      const response = await call({ origin: DEPLOYED_ORIGIN, path });
      expect(response.status, path).toBe(404);
    }
    expect(rateLimitRows()).toBe(before);

    // A real endpoint is still served, and counted.
    const session = await call({ origin: DEPLOYED_ORIGIN, path: "/get-session" });
    expect(session.status).toBe(200);
    expect(rateLimitRows()).toBe(before + 1);
  });
});

describe("adding a passkey", () => {
  it("stops once the account holds the most it may", async () => {
    const jar = await signIn();
    for (let index = 0; index < MAX_PASSKEYS_PER_USER - 1; index += 1) {
      addPasskey(`key-${index}`);
    }
    const below = await call({ path: "/passkey/generate-register-options", jar });
    expect(below.status).toBe(200);

    addPasskey("last");
    for (const [path, body] of [
      ["/passkey/generate-register-options", undefined],
      ["/passkey/verify-registration", { response: {} }],
    ] as const) {
      const refused = await call({ path, jar, body });
      expect(refused.status, path).toBe(403);
      expect(await refused.json()).toMatchObject({ code: "TOO_MANY_PASSKEYS" });
    }
  });
});
