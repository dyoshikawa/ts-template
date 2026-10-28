import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { getAuthenticatorName, passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware, getAuthoritativeSessionFromCtx } from "better-auth/api";
import { captcha, emailOTP } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { env, waitUntil } from "cloudflare:workers";

import { createDb } from "../db/client";
import { APP_NAME } from "./app";
import {
  assertPasskeyOwnerAllowed,
  AUTHORITATIVE_SESSION_PATHS,
  DISABLED_AUTH_PATHS,
  guardAuthRequest,
  SEND_OTP_PATH,
  SIGN_IN_OTP_PATH,
  VERIFY_PASSKEY_REGISTRATION_PATH,
} from "./auth-guard";
import { resolveAuthSecret } from "./auth-secret";
import { isLocalRequest } from "./local-request";
import { OTP_LENGTH } from "./otp-code";
import { buildOtpEmail, type OtpEmail } from "./otp-email";
import { passkeyConfig } from "./passkey";
import { buildPasskeyAddedEmail } from "./passkey-email";
import { PASSKEY_LABEL, passkeyName } from "./passkey-name";
import { turnstileBinding, turnstileConfig } from "./turnstile";

const OTP_EXPIRES_IN_SECONDS = 10 * 60;
// Signing in means fetching a code from the mailbox, so a session is kept
// for a long time and slid forward once a day while the user keeps coming back.
const SESSION_EXPIRES_IN_SECONDS = 90 * 24 * 60 * 60;
const SESSION_UPDATE_AGE_SECONDS = 24 * 60 * 60;

/**
 * Cookie names for an `https` origin carry the `__Host-` prefix, which the
 * browser accepts only with `Secure`, `Path=/` and no `Domain`: a sibling host
 * under the same parent domain cannot plant a session cookie that the app
 * would read in place of the user's own. Plain `http` (local runs) keeps the
 * default names, since such cookies must be `Secure`.
 */
function cookieAdvanced({ request }: { request: Request }) {
  if (new URL(request.url).protocol !== "https:") {
    return {};
  }
  return {
    useSecureCookies: false,
    cookiePrefix: "__Host-better-auth",
    defaultCookieAttributes: { secure: true },
  };
}

/**
 * Builds a Better Auth instance for one request. Bindings (D1, Email Service)
 * are only reachable through `env`, and the base URL is taken from the request
 * so the same code serves `vite dev` and every deployed hostname.
 *
 * Sign-in is passwordless: the user enters an email address, receives an
 * 8-digit one-time code, and enters that code. First-time addresses are
 * registered on the spot — unless `ALLOWED_EMAILS` restricts who may sign in.
 * A signed-in user can then add passkeys and sign in with one instead (on
 * the hosts `passkeyConfig` allows); the email code always keeps working.
 */
export function createAuth({ request }: { request: Request }) {
  // Throws on a deployed Worker without a usable secret (see `resolveAuthSecret`).
  const secret = resolveAuthSecret({ request });
  const turnstile = turnstileConfig({ request });
  const passkeys = passkeyConfig({ request });
  const binding = turnstileBinding({ request });
  return betterAuth({
    baseURL: new URL(request.url).origin,
    secret,
    disabledPaths: DISABLED_AUTH_PATHS,
    database: drizzleAdapter(createDb({ d1: env.DB }), { provider: "sqlite" }),
    session: {
      expiresIn: SESSION_EXPIRES_IN_SECONDS,
      updateAge: SESSION_UPDATE_AGE_SECONDS,
      // Avoid a D1 round trip on every request; the cookie is re-validated
      // against the database once it is older than `maxAge`.
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
    telemetry: { enabled: false },
    rateLimit: {
      // The library's default (`NODE_ENV === "production"`) is never true in
      // a Worker, so it is switched on here. The mailer is the endpoint worth
      // protecting (the email OTP plugin allows three sends a minute per
      // address). Counted in D1 (the `rateLimit` table) so every isolate sees
      // the same tally; off for local runs so browser tests can sign in freely.
      enabled: !isLocalRequest(request),
      storage: "database",
      // Passkey sign-in needs no Turnstile, and every challenge it hands out
      // is a D1 write, so it gets a tighter limit than the default 100 per
      // 10 s. The sign-in page asks for one challenge per visit (the email
      // field's autofill) and one per press of the passkey button.
      customRules: {
        "/passkey/generate-authenticate-options": { window: 60, max: 20 },
        "/passkey/verify-authentication": { window: 60, max: 10 },
      },
    },
    advanced: {
      // The client address Cloudflare stamps on every request; `x-forwarded-for`
      // can be supplied by the client and is not trusted.
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
      ...cookieAdvanced({ request }),
    },
    hooks: {
      // Allowlist, sign-in codes only, and no codes at all from a Worker
      // without a Turnstile key pair (see `guardAuthRequest`).
      // Adding or removing a passkey also needs the session in the database:
      // the endpoint itself trusts the cookie cache, which would let a
      // signed-out or revoked session do it for a few more minutes.
      before: createAuthMiddleware(async (ctx) => {
        guardAuthRequest({ path: ctx.path, body: ctx.body, turnstile });
        if (
          AUTHORITATIVE_SESSION_PATHS.has(ctx.path) &&
          !(await getAuthoritativeSessionFromCtx(ctx))
        ) {
          throw new APIError("UNAUTHORIZED");
        }
      }),
      // The notice of a new passkey goes out once it is stored, never for a
      // registration that failed on the way, and after the answer (the user
      // sees the passkey listed at once).
      after: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== VERIFY_PASSKEY_REGISTRATION_PATH) {
          return;
        }
        const stored = storedPasskeyName(ctx.context.returned);
        const email = ctx.context.session?.user.email;
        if (stored !== undefined && email) {
          waitUntil(notifyPasskeyAdded({ email, passkeyName: stored, request }));
        }
      }),
    },
    plugins: [
      // Sending a sign-in code and entering one each need a passed Turnstile
      // challenge (the `x-captcha-response` header), so bots can neither
      // drive the mailer nor spend someone else's code on wrong guesses (a
      // code takes three). On a deployed Worker the token must be solved on
      // this app's hostname for signing in (`turnstileBinding`), not on the
      // account-deletion form. Local runs and browser tests can switch this
      // off (`TURNSTILE_DISABLED`); without a key pair sending is refused
      // outright (`guardAuthRequest`).
      ...(turnstile.status === "enabled"
        ? [
            captcha({
              provider: "cloudflare-turnstile",
              secretKey: turnstile.secretKey,
              endpoints: [SEND_OTP_PATH, SIGN_IN_OTP_PATH],
              ...(binding
                ? { expectedAction: "sign-in", allowedHostnames: [binding.hostname] }
                : {}),
            }),
          ]
        : []),
      emailOTP({
        otpLength: OTP_LENGTH,
        expiresIn: OTP_EXPIRES_IN_SECONDS,
        // Browser tests sign in with a fixed code (`E2E_SIGN_IN_CODE`), only
        // ever for a local address; otherwise Better Auth draws a random one.
        generateOTP: () => (isLocalRequest(request) && env.E2E_SIGN_IN_CODE) || undefined,
        sendVerificationOTP: async ({ email, otp, type }) => {
          // Only sign-in codes are ever mailed (also refused earlier by
          // `guardAuthRequest`); other kinds are not part of the app's flow.
          if (type !== "sign-in") {
            return;
          }
          await sendOtp({ email, otp });
        },
      }),
      // Passkeys are added by a signed-in user only (Better Auth's default,
      // with a session at most a day old), never at sign-up. No Turnstile:
      // signing in with one mails nothing.
      ...(passkeys.status === "enabled"
        ? [
            passkey({
              rpID: passkeys.rpID,
              rpName: APP_NAME,
              origin: passkeys.origin,
              registration: {
                afterVerification: ({ ctx, verification }) => ({
                  name: passkeyName({
                    provider: getAuthenticatorName(verification.registrationInfo?.aaguid),
                    userAgent: ctx.request?.headers.get("user-agent") ?? null,
                  }),
                }),
              },
              authentication: {
                // Before the session is made: an account no longer in
                // `ALLOWED_EMAILS` does not sign in with an old passkey.
                afterVerification: async ({ ctx, clientData }) => {
                  await assertPasskeyOwnerAllowed({
                    credentialId: clientData.id,
                    findOwnerEmail: async (credentialID) => {
                      const stored = await ctx.context.adapter.findOne<{ userId: string }>({
                        model: "passkey",
                        where: [{ field: "credentialID", value: credentialID }],
                      });
                      if (!stored) {
                        return null;
                      }
                      const owner = await ctx.context.internalAdapter.findUserById(stored.userId);
                      return owner?.email ?? null;
                    },
                  });
                },
              },
            }),
          ]
        : []),
      tanstackStartCookies(),
    ],
  });
}

async function sendOtp({ email, otp }: { email: string; otp: string }): Promise<void> {
  const message = buildOtpEmail({
    appName: APP_NAME,
    otp,
    expiresInMinutes: OTP_EXPIRES_IN_SECONDS / 60,
  });

  if (import.meta.env.DEV) {
    // No email leaves the dev server; read the code from the terminal instead.
    // oxlint-disable-next-line no-console
    console.info(`[auth] sign-in code for ${email}: ${otp}`);
    return;
  }

  await sendMail({ email, message });
}

/**
 * The label of the passkey `/passkey/verify-registration` answered with, or
 * `undefined` when it answered with an error (an `APIError`, which has no
 * `credentialID`).
 */
function storedPasskeyName(returned: unknown): string | undefined {
  if (typeof returned !== "object" || returned === null || !("credentialID" in returned)) {
    return undefined;
  }
  const { name } = returned as { name?: unknown };
  return typeof name === "string" && name !== "" ? name : PASSKEY_LABEL;
}

/**
 * Tells the account's address that a passkey was added. A failed send is
 * logged and swallowed: the passkey is already verified, and the user sees
 * it listed on the account page either way.
 */
async function notifyPasskeyAdded({
  email,
  passkeyName: name,
  request,
}: {
  email: string;
  passkeyName: string;
  request: Request;
}): Promise<void> {
  const message = buildPasskeyAddedEmail({
    appName: APP_NAME,
    passkeyName: name,
    accountUrl: new URL("/account", request.url).toString(),
  });
  if (import.meta.env.DEV) {
    // oxlint-disable-next-line no-console
    console.info(`[auth] passkey "${name}" added for ${email}`);
    return;
  }
  try {
    await sendMail({ email, message });
  } catch (error) {
    // oxlint-disable-next-line no-console
    console.error("[auth] could not mail the passkey notice", error);
  }
}

async function sendMail({ email, message }: { email: string; message: OtpEmail }): Promise<void> {
  await env.EMAIL.send({
    from: env.EMAIL_FROM,
    to: email,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });
}
