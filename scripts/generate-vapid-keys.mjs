// Prints a new VAPID key pair for push notifications (`pnpm vapid`):
//
// - VAPID_PUBLIC_KEY goes in wrangler.jsonc `vars` (browsers subscribe with it);
// - VAPID_PRIVATE_KEY is a secret: `wrangler secret put VAPID_PRIVATE_KEY`,
//   and `.dev.vars` for local runs.
//
// Changing the pair later invalidates every existing subscription: browsers
// have to subscribe again.
import { generateKeyPairSync } from "node:crypto";

const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const jwk = privateKey.export({ format: "jwk" });
const rawPublic = publicKey.export({ format: "der", type: "spki" }).subarray(-65);

process.stdout.write(`VAPID_PUBLIC_KEY=${rawPublic.toString("base64url")}\n`);
process.stdout.write(`VAPID_PRIVATE_KEY=${jwk.d}\n`);
