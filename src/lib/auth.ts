import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
import { captcha, emailOTP } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { env } from "cloudflare:workers";

import { createDb } from "../db/client";
import { APP_NAME } from "./app";
import { DISABLED_AUTH_PATHS, guardAuthRequest, SEND_OTP_PATH } from "./auth-guard";
import { isLocalRequest } from "./local-request";
import { buildOtpEmail } from "./otp-email";
import { turnstileConfig } from "./turnstile";

const OTP_LENGTH = 6;
const OTP_EXPIRES_IN_SECONDS = 10 * 60;
// Signing in means fetching a code from the mailbox, so a session is kept
// for a long time and slid forward once a day while the user keeps coming back.
const SESSION_EXPIRES_IN_SECONDS = 90 * 24 * 60 * 60;
const SESSION_UPDATE_AGE_SECONDS = 24 * 60 * 60;
// Only ever used by `vite dev`, where there is no `wrangler secret`.
const DEV_SECRET = "insecure-dev-only-secret-do-not-use-in-production";

/**
 * Builds a Better Auth instance for one request. Bindings (D1, Email Service)
 * are only reachable through `env`, and the base URL is taken from the request
 * so the same code serves `vite dev` and every deployed hostname.
 *
 * Sign-in is passwordless: the user enters an email address, receives a
 * 6-digit one-time code, and enters that code. First-time addresses are
 * registered on the spot — unless `ALLOWED_EMAILS` restricts who may sign in.
 */
export function createAuth({ request }: { request: Request }) {
  const turnstile = turnstileConfig({ request });
  return betterAuth({
    baseURL: new URL(request.url).origin,
    secret: env.BETTER_AUTH_SECRET ?? (import.meta.env.DEV ? DEV_SECRET : undefined),
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
    },
    advanced: {
      // The client address Cloudflare stamps on every request; `x-forwarded-for`
      // can be supplied by the client and is not trusted.
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
    },
    hooks: {
      // Allowlist, sign-in codes only, and no codes at all from a Worker
      // without a Turnstile key pair (see `guardAuthRequest`).
      before: createAuthMiddleware(async (ctx) => {
        guardAuthRequest({ path: ctx.path, body: ctx.body, turnstile });
      }),
    },
    plugins: [
      // Sending a sign-in code needs a passed Turnstile challenge (the
      // `x-captcha-response` header), so the mailer cannot be driven by bots.
      // Local runs and browser tests can switch this off (`TURNSTILE_DISABLED`);
      // without a key pair the endpoint is refused outright (`guardAuthRequest`).
      ...(turnstile.status === "enabled"
        ? [
            captcha({
              provider: "cloudflare-turnstile",
              secretKey: turnstile.secretKey,
              endpoints: [SEND_OTP_PATH],
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

  await env.EMAIL.send({
    from: env.EMAIL_FROM,
    to: email,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });
}
