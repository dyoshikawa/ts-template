import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const getSession = vi.fn();
const createAuth = vi.fn(() => ({ api: { getSession } }));
vi.mock("./auth", () => ({ createAuth }));

let current = new Request("https://app.example.com/");
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
    current = new Request("https://app.example.com/");
    await Promise.all([readSession(), requireUserId(), requireUserId()]);
    expect(createAuth).toHaveBeenCalledTimes(1);
    expect(getSession).toHaveBeenCalledTimes(1);

    current = new Request("https://app.example.com/");
    expect(await requireUserId()).toBe("user-1");
    expect(getSession).toHaveBeenCalledTimes(2);
  });

  it("refuses a request without a session", async () => {
    current = new Request("https://app.example.com/");
    getSession.mockResolvedValue(null);
    await expect(requireUserId()).rejects.toBeInstanceOf(Response);
  });
});
