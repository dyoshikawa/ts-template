/**
 * Web Push on WebCrypto alone, so it runs in a Worker (the `web-push` npm
 * package needs Node's `crypto`). Two standards make a push:
 *
 * - RFC 8291: the payload is encrypted for the browser's subscription keys
 *   (`p256dh`, `auth`) with the `aes128gcm` content coding (RFC 8188).
 * - RFC 8292 (VAPID): the request carries a JWT signed with the app's
 *   private key, so the push service knows who is sending.
 */

/** What a browser hands out on subscribing (`PushSubscription.toJSON()`). */
export type PushSubscriptionKeys = {
  endpoint: string;
  /** The browser's P-256 public key, uncompressed, base64url. */
  p256dh: string;
  /** The browser's 16-byte authentication secret, base64url. */
  auth: string;
};

/** The app's VAPID identity: the key pair from `pnpm vapid`, and a contact. */
export type VapidKeys = {
  /** Uncompressed P-256 public key (65 bytes), base64url. */
  publicKey: string;
  /** The private scalar `d` (32 bytes), base64url. */
  privateKey: string;
  /** A `mailto:` or `https:` URL the push service may contact. */
  subject: string;
};

/** One record for the whole message: payloads are far below the push services' 4 KB limit. */
const RECORD_SIZE = 4096;
const encoder = new TextEncoder();

export function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCodePoint(byte);
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

export function base64UrlDecode(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
  return Uint8Array.from(binary, (char) => char.codePointAt(0) ?? 0);
}

function concat(...parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

async function hmacSha256(key: Uint8Array<ArrayBuffer>, data: Uint8Array<ArrayBuffer>) {
  const imported = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", imported, data));
}

/** HKDF (RFC 5869) with a single expand block, which is all Web Push needs. */
async function hkdf({
  salt,
  ikm,
  info,
  length,
}: {
  salt: Uint8Array<ArrayBuffer>;
  ikm: Uint8Array<ArrayBuffer>;
  info: Uint8Array<ArrayBuffer>;
  length: number;
}): Promise<Uint8Array<ArrayBuffer>> {
  const prk = await hmacSha256(salt, ikm);
  return (await hmacSha256(prk, concat(info, new Uint8Array([1])))).slice(0, length);
}

/** A P-256 key as a JWK, from its uncompressed public point and, for a private key, `d`. */
function p256Jwk({ publicKey, d }: { publicKey: Uint8Array; d?: string }): JsonWebKey {
  if (publicKey.length !== 65 || publicKey[0] !== 4) {
    throw new Error("Expected an uncompressed P-256 public key");
  }
  return {
    kty: "EC",
    crv: "P-256",
    x: base64UrlEncode(publicKey.slice(1, 33)),
    y: base64UrlEncode(publicKey.slice(33, 65)),
    ...(d === undefined ? {} : { d }),
    ext: true,
  };
}

/** The sender's ephemeral ECDH key pair; tests pass a fixed one. */
export type SenderKeys = { publicKey: Uint8Array<ArrayBuffer>; privateKey: CryptoKey };

async function newSenderKeys(): Promise<SenderKeys> {
  const pair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
    "deriveBits",
  ]);
  const publicKey = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  return { publicKey, privateKey: pair.privateKey };
}

/** Imports a fixed sender key pair (the RFC's example, in tests). */
export async function importSenderKeys({
  publicKey,
  privateKey,
}: {
  publicKey: string;
  privateKey: string;
}): Promise<SenderKeys> {
  const raw = base64UrlDecode(publicKey);
  const key = await crypto.subtle.importKey(
    "jwk",
    p256Jwk({ publicKey: raw, d: privateKey }),
    { name: "ECDH", namedCurve: "P-256" },
    false,
    ["deriveBits"],
  );
  return { publicKey: raw, privateKey: key };
}

/**
 * Encrypts `payload` for one subscription (RFC 8291 §3.4) and returns the
 * `aes128gcm` request body: salt, record size, the sender's public key,
 * then the ciphertext. `salt` and `sender` are drawn fresh unless given.
 */
export async function encryptPayload({
  payload,
  p256dh,
  auth,
  salt = crypto.getRandomValues(new Uint8Array(16)),
  sender,
}: {
  payload: Uint8Array<ArrayBuffer>;
  p256dh: string;
  auth: string;
  salt?: Uint8Array<ArrayBuffer>;
  sender?: SenderKeys;
}): Promise<Uint8Array<ArrayBuffer>> {
  const { publicKey: senderPublic, privateKey: senderPrivate } = sender ?? (await newSenderKeys());
  const receiverPublic = base64UrlDecode(p256dh);
  const receiverKey = await crypto.subtle.importKey(
    "raw",
    receiverPublic,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const ecdhSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "ECDH", public: receiverKey }, senderPrivate, 256),
  );

  const ikm = await hkdf({
    salt: base64UrlDecode(auth),
    ikm: ecdhSecret,
    info: concat(encoder.encode("WebPush: info\0"), receiverPublic, senderPublic),
    length: 32,
  });
  const cek = await hkdf({
    salt,
    ikm,
    info: encoder.encode("Content-Encoding: aes128gcm\0"),
    length: 16,
  });
  const nonce = await hkdf({
    salt,
    ikm,
    info: encoder.encode("Content-Encoding: nonce\0"),
    length: 12,
  });

  const key = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  // 0x02 marks the last (and only) record; no further padding.
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce },
      key,
      concat(payload, new Uint8Array([2])),
    ),
  );

  const header = new Uint8Array(21);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, RECORD_SIZE);
  header[20] = senderPublic.length;
  return concat(header, senderPublic, ciphertext);
}

/**
 * The `Authorization` header for a push to `endpoint` (RFC 8292): a JWT for
 * the endpoint's origin, valid for 12 hours, signed with the VAPID key.
 */
export async function vapidAuthorization({
  endpoint,
  vapid,
  now = Date.now(),
}: {
  endpoint: string;
  vapid: VapidKeys;
  now?: number;
}): Promise<string> {
  const key = await crypto.subtle.importKey(
    "jwk",
    p256Jwk({ publicKey: base64UrlDecode(vapid.publicKey), d: vapid.privateKey }),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const encode = (value: object) => base64UrlEncode(encoder.encode(JSON.stringify(value)));
  const unsigned = `${encode({ typ: "JWT", alg: "ES256" })}.${encode({
    aud: new URL(endpoint).origin,
    exp: Math.floor(now / 1000) + 12 * 60 * 60,
    sub: vapid.subject,
  })}`;
  // WebCrypto signs ECDSA as r || s, which is exactly JWS's ES256 form.
  const signature = new Uint8Array(
    await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, encoder.encode(unsigned)),
  );
  return `vapid t=${unsigned}.${base64UrlEncode(signature)}, k=${vapid.publicKey}`;
}

/**
 * Sends one push message and returns the push service's status: 201 when
 * accepted, 404 or 410 when the subscription is gone for good (drop it).
 */
export async function sendWebPush({
  subscription,
  payload,
  vapid,
  ttlSeconds = 24 * 60 * 60,
}: {
  subscription: PushSubscriptionKeys;
  payload: string;
  vapid: VapidKeys;
  ttlSeconds?: number;
}): Promise<number> {
  const body = await encryptPayload({
    payload: encoder.encode(payload),
    p256dh: subscription.p256dh,
    auth: subscription.auth,
  });
  const response = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      Authorization: await vapidAuthorization({ endpoint: subscription.endpoint, vapid }),
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: String(ttlSeconds),
      Urgency: "normal",
    },
    body,
  });
  // The body is not needed; read it so the connection is released.
  await response.arrayBuffer();
  return response.status;
}
