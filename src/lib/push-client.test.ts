import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { resyncSubscription } from "./push-client";
import { savePushSubscription } from "./push-functions";

vi.mock("./push-functions", () => ({
  savePushSubscription: vi.fn(),
  deletePushSubscription: vi.fn(),
}));

/** Gives the page a service worker whose push manager holds `subscription`. */
function stubSubscription(subscription: object | null): void {
  vi.stubGlobal("navigator", {
    ...navigator,
    serviceWorker: {
      getRegistration: async () => ({
        pushManager: { getSubscription: async () => subscription },
      }),
    },
  });
}

const SUBSCRIPTION = {
  endpoint: "https://fcm.googleapis.com/fcm/send/unit",
  toJSON: () => ({
    endpoint: "https://fcm.googleapis.com/fcm/send/unit",
    keys: { p256dh: "p256dh", auth: "auth" },
  }),
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.mocked(savePushSubscription).mockReset();
});

describe("resyncSubscription", () => {
  it("answers unsubscribed without asking the server when the device has no subscription", async () => {
    stubSubscription(null);
    expect(await resyncSubscription()).toEqual({ subscribed: false });
    expect(savePushSubscription).not.toHaveBeenCalled();
  });

  it("sends the subscription again", async () => {
    stubSubscription(SUBSCRIPTION);
    expect(await resyncSubscription()).toEqual({ subscribed: true });
    expect(savePushSubscription).toHaveBeenCalledWith({
      data: { endpoint: SUBSCRIPTION.endpoint, p256dh: "p256dh", auth: "auth" },
    });
  });

  it("still answers subscribed when sending fails, with why", async () => {
    const failure = new TypeError("Failed to fetch");
    vi.mocked(savePushSubscription).mockRejectedValue(failure);
    stubSubscription(SUBSCRIPTION);
    expect(await resyncSubscription()).toEqual({ subscribed: true, saveError: failure });
  });
});
