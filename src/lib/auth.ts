import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { captcha, emailOTP } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { env } from "cloudflare:workers";

import { createDb } from "../db/client";
import { APP_NAME } from "./app";
import { isLocalRequest } from "./local-request";
import { buildOtpEmail } from "./otp-email";
import { isEmailAllowed } from "./sign-in-allowlist";
import { turnstileDisabled, turnstileSecretKey } from "./turnstile";

const OTP_LENGTH = 6;
const OTP_EXPIRES_IN_SECONDS = 10 * 60;
const SIGN_IN_PATHS = new Set(["/email-otp/send-verification-otp", "/sign-in/email-otp"]);

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
  return betterAuth({
    baseURL: new URL(request.url).origin,
    secret: env.BETTER_AUTH_SECRET ?? (import.meta.env.DEV ? DEV_SECRET : undefined),
    database: drizzleAdapter(createDb({ d1: env.DB }), { provider: "sqlite" }),
    session: {
      // Avoid a D1 round trip on every request; the cookie is re-validated
      // against the database once it is older than `maxAge`.
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
    hooks: {
      // Addresses outside `ALLOWED_EMAILS` get neither a code nor a session.
      before: createAuthMiddleware(async (ctx) => {
        if (!SIGN_IN_PATHS.has(ctx.path)) {
          return;
        }
        const email: unknown = ctx.body?.email;
        if (typeof email === "string" && !isEmailAllowed(email)) {
          throw new APIError("FORBIDDEN", { message: "This email address cannot sign in." });
        }
      }),
    },
    plugins: [
      // Sending a sign-in code needs a passed Turnstile challenge (the
      // `x-captcha-response` header), so the mailer cannot be driven by bots.
      // Local runs and browser tests can switch this off (`TURNSTILE_DISABLED`).
      ...(turnstileDisabled({ request })
        ? []
        : [
            captcha({
              provider: "cloudflare-turnstile",
              secretKey: turnstileSecretKey(),
              endpoints: ["/email-otp/send-verification-otp"],
            }),
          ]),
      emailOTP({
        otpLength: OTP_LENGTH,
        expiresIn: OTP_EXPIRES_IN_SECONDS,
        // Browser tests sign in with a fixed code (`E2E_SIGN_IN_CODE`), only
        // ever for a local address; otherwise Better Auth draws a random one.
        generateOTP: () => (isLocalRequest(request) && env.E2E_SIGN_IN_CODE) || undefined,
        sendVerificationOTP: async ({ email, otp }) => {
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
