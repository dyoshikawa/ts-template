import { afterEach, describe, expect, it, vi } from "vitest";

import {
  base64UrlDecode,
  base64UrlEncode,
  encryptPayload,
  importSenderKeys,
  sendWebPush,
  vapidAuthorization,
} from "./web-push";

// The worked example of RFC 8291 §5.
const RFC_8291 = {
  plaintext: "When I grow up, I want to be a watermelon",
  auth: "BTBZMqHH6r4Tts7J_aSIgg",
  receiverPublic:
    "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
  senderPublic:
    "BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8",
  senderPrivate: "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw",
  salt: "DGv6ra1nlYgDCS1FRnbzlw",
  body:
    "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27ml" +
    "mlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPT" +
    "pK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN",
};

/** A fresh VAPID key pair in the form `pnpm vapid` prints. */
async function newVapid() {
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
    "verify",
  ]);
  const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  const publicKey = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  return {
    keys: {
      publicKey: base64UrlEncode(publicKey),
      privateKey: jwk.d ?? "",
      subject: "mailto:admin@example.com",
    },
    verifyKey: pair.publicKey,
  };
}

const decode = (part: string): unknown =>
  JSON.parse(new TextDecoder().decode(base64UrlDecode(part)));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("base64url", () => {
  it("round-trips bytes without padding", () => {
    const bytes = new Uint8Array([251, 255, 0, 1, 2]);
    const encoded = base64UrlEncode(bytes);
    expect(encoded).toBe("-_8AAQI");
    expect([...base64UrlDecode(encoded)]).toEqual([...bytes]);
  });
});

describe("encryptPayload", () => {
  it("reproduces the RFC 8291 example byte for byte", async () => {
    const body = await encryptPayload({
      payload: new TextEncoder().encode(RFC_8291.plaintext),
      p256dh: RFC_8291.receiverPublic,
      auth: RFC_8291.auth,
      salt: base64UrlDecode(RFC_8291.salt),
      sender: await importSenderKeys({
        publicKey: RFC_8291.senderPublic,
        privateKey: RFC_8291.senderPrivate,
      }),
    });
    expect(base64UrlEncode(body)).toBe(RFC_8291.body);
  });

  it("draws a fresh salt and sender key each time", async () => {
    const encrypt = () =>
      encryptPayload({
        payload: new TextEncoder().encode("hi"),
        p256dh: RFC_8291.receiverPublic,
        auth: RFC_8291.auth,
      });
    const [first, second] = await Promise.all([encrypt(), encrypt()]);
    expect(base64UrlEncode(first.slice(0, 16))).not.toBe(base64UrlEncode(second.slice(0, 16)));
    expect(base64UrlEncode(first.slice(21, 86))).not.toBe(base64UrlEncode(second.slice(21, 86)));
  });
});

describe("vapidAuthorization", () => {
  it("signs a JWT for the endpoint's origin that the public key verifies", async () => {
    const { keys, verifyKey } = await newVapid();
    const now = Date.UTC(2026, 0, 1);
    const header = await vapidAuthorization({
      endpoint: "https://fcm.googleapis.com/fcm/send/abc",
      vapid: keys,
      now,
    });

    const match = /^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/u.exec(header);
    expect(match).not.toBeNull();
    const [, head = "", claims = "", signature = "", k] = match ?? [];
    expect(k).toBe(keys.publicKey);
    expect(decode(head)).toEqual({ typ: "JWT", alg: "ES256" });
    expect(decode(claims)).toEqual({
      aud: "https://fcm.googleapis.com",
      exp: now / 1000 + 12 * 60 * 60,
      sub: "mailto:admin@example.com",
    });
    const valid = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      verifyKey,
      base64UrlDecode(signature),
      new TextEncoder().encode(`${head}.${claims}`),
    );
    expect(valid).toBe(true);
  });
});

describe("sendWebPush", () => {
  it("posts the encrypted payload with the Web Push headers", async () => {
    const { keys } = await newVapid();
    const fetchMock = vi.fn(
      async (_url: string, _init: RequestInit) => new Response(null, { status: 201 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const status = await sendWebPush({
      subscription: {
        endpoint: "https://fcm.googleapis.com/fcm/send/abc",
        p256dh: RFC_8291.receiverPublic,
        auth: RFC_8291.auth,
      },
      payload: JSON.stringify({ title: "Hello" }),
      vapid: keys,
      ttlSeconds: 60,
    });

    expect(status).toBe(201);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("https://fcm.googleapis.com/fcm/send/abc");
    const headers = new Headers(init?.headers);
    expect(headers.get("Content-Encoding")).toBe("aes128gcm");
    expect(headers.get("TTL")).toBe("60");
    expect(headers.get("Authorization")).toMatch(/^vapid t=.+, k=/u);
    // Header (86 bytes) + payload + delimiter + 16-byte tag.
    const body = init?.body as Uint8Array;
    expect(body.length).toBe(86 + '{"title":"Hello"}'.length + 1 + 16);
  });
});
