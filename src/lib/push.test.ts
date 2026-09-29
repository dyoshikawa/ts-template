import { describe, expect, it } from "vitest";

import { isPushServiceEndpoint } from "./push";

describe("isPushServiceEndpoint", () => {
  it.each([
    "https://fcm.googleapis.com/fcm/send/abc",
    "https://updates.push.services.mozilla.com/wpush/v2/abc",
    "https://web.push.apple.com/abc",
    "https://wns2-par02p.notify.windows.com/w/?token=abc",
  ])("accepts %s", (endpoint) => {
    expect(isPushServiceEndpoint(endpoint)).toBe(true);
  });

  it.each([
    "http://fcm.googleapis.com/fcm/send/abc",
    "https://fcm.googleapis.com:8443/fcm/send/abc",
    "https://fcm.googleapis.com.example.com/abc",
    "https://example.com/push",
    "https://localhost/push",
    "not a url",
  ])("refuses %s", (endpoint) => {
    expect(isPushServiceEndpoint(endpoint)).toBe(false);
  });
});
