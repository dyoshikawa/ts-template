import { createFileRoute, redirect, useNavigate, useRouter } from "@tanstack/react-router";
import { type FormEvent, type ReactNode, useEffect, useEffectEvent, useRef, useState } from "react";

import { BusyLabel } from "../components/spinner";
import { Turnstile } from "../components/turnstile";
import {
  inputClass,
  linkButtonClass,
  primaryButtonClass,
  secondaryButtonClass,
  BUTTON_EMOJI,
} from "../components/ui";
import { getPasskeyAvailability, getTurnstileConfig } from "../lib/account-functions";
import { authClient } from "../lib/auth-client";
import { formatOtp, normalizeOtp, OTP_LENGTH } from "../lib/otp-code";
import {
  passkeySignInErrorMessage,
  requestPasskeyOffer,
  usePasskeysSupported,
} from "../lib/passkey-browser";

export const Route = createFileRoute("/login")({
  beforeLoad: ({ context }) => {
    if (context.session) {
      throw redirect({ to: "/" });
    }
  },
  loader: async () => {
    const [{ turnstile }, { passkeys }] = await Promise.all([
      getTurnstileConfig(),
      getPasskeyAvailability(),
    ]);
    return { turnstile, passkeys };
  },
  component: LoginPage,
});

type Step = { name: "email" } | { name: "otp"; email: string };

/** After this many failed passkey sign-ins, the email field stops suggesting passkeys. */
const MAX_AUTO_FILL_FAILURES = 5;

function LoginPage() {
  const router = useRouter();
  const navigate = useNavigate();
  const { turnstile, passkeys: passkeysOffered } = Route.useLoaderData();
  const [step, setStep] = useState<Step>({ name: "email" });
  const [error, setError] = useState<string | null>(null);
  // The request on its way, if any: its button shows a spinner, and every
  // button waits until it settles.
  const [busy, setBusy] = useState<"send" | "verify" | "passkey" | null>(null);
  const pending = busy !== null;
  const supported = usePasskeysSupported();
  const passkeys = passkeysOffered && supported;
  // Sending a code needs a passed Turnstile challenge; entering it does not.
  // A token is single-use, so the widget is remounted (fresh token) after
  // every send.
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [captchaRound, setCaptchaRound] = useState(0);

  const sendCode = async ({ email }: { email: string }) => {
    if (!captcha) {
      setError("Wait a moment for the check to finish.");
      return;
    }
    setBusy("send");
    setError(null);
    const { error: sendError } = await authClient.emailOtp.sendVerificationOtp(
      { email, type: "sign-in" },
      { headers: { "x-captcha-response": captcha } },
    );
    setCaptcha(null);
    setCaptchaRound((round) => round + 1);
    setBusy(null);
    if (sendError) {
      setError(sendError.message ?? "Could not send the code. Please try again.");
      return;
    }
    setStep({ name: "otp", email });
  };

  const challenge = (
    <Turnstile key={captchaRound} config={turnstile} action="sign-in" onToken={setCaptcha} />
  );

  const verifyCode = async ({ email, otp }: { email: string; otp: string }) => {
    setBusy("verify");
    setError(null);
    const { error: verifyError } = await authClient.signIn.emailOtp({ email, otp });
    if (verifyError) {
      setBusy(null);
      setError(verifyError.message ?? "That code is not right. Please try again.");
      return;
    }
    if (passkeys) {
      requestPasskeyOffer();
    }
    await router.invalidate();
    await navigate({ to: "/" });
  };

  // Bumped to wait for the email field's passkey suggestions again; failures
  // (not cancels) are counted against MAX_AUTO_FILL_FAILURES. See below.
  const [autoFillRounds, setAutoFillRounds] = useState({ round: 0, failures: 0 });
  // Set while the button's attempt runs, so an autofill that was about to
  // start does not abort it (a new WebAuthn request aborts the pending one).
  const buttonInFlight = useRef(false);

  /**
   * Signs in with a passkey: from the button, or (`autoFill`) from the
   * browser's suggestions under the email field, which wait in the
   * background until the user picks one. Pressing the button aborts that
   * wait (reported as `ERROR_CEREMONY_ABORTED`, ignored); once the button's
   * attempt ends or a picked suggestion fails, the wait starts again.
   */
  const signInWithPasskey = async ({ autoFill }: { autoFill: boolean }) => {
    // Only the button clears the message: the autofill restarts right after
    // a failed press, and would otherwise wipe that failure's message.
    if (!autoFill) {
      buttonInFlight.current = true;
      setBusy("passkey");
      setError(null);
    }
    const { error: passkeyError } = await authClient.signIn.passkey({ autoFill });
    if (!autoFill) {
      buttonInFlight.current = false;
    }
    if (passkeyError) {
      if (!autoFill) {
        setBusy(null);
      }
      const message = passkeySignInErrorMessage(passkeyError);
      if (message) {
        setError(message);
      }
      // The wait starts again after every press, and after a suggestion that
      // was picked but failed. An autofill that ended without a message was
      // aborted by the button or given up by the browser: restarting it then
      // could loop as fast as the browser refuses.
      if (!autoFill || message !== null) {
        setAutoFillRounds(({ round, failures }) => ({
          round: round + 1,
          failures: message === null ? failures : failures + 1,
        }));
      }
      return;
    }
    await router.invalidate();
    await navigate({ to: "/" });
  };

  const offerAutoFill = useEffectEvent(() => signInWithPasskey({ autoFill: true }));

  // Started when passkeys turn out to be usable and again after each attempt
  // (only until a few have failed, so a failing server is not hammered); the
  // wait outlives renders.
  useEffect(() => {
    if (!passkeys || autoFillRounds.failures >= MAX_AUTO_FILL_FAILURES) {
      return;
    }
    let cancelled = false;
    void (async () => {
      const conditional = await PublicKeyCredential.isConditionalMediationAvailable?.();
      if (conditional && !cancelled && !buttonInFlight.current) {
        await offerAutoFill();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [passkeys, autoFillRounds]);

  return (
    <main className="mx-auto flex max-w-sm flex-col gap-6 p-4 sm:p-8">
      <h1 className="text-2xl font-bold">Sign in</h1>
      {step.name === "email" ? (
        <>
          <EmailForm
            pending={pending}
            sending={busy === "send"}
            ready={captcha !== null}
            passkeys={passkeys}
            challenge={challenge}
            onSubmit={sendCode}
          />
          {passkeys ? (
            <section className="flex flex-col gap-2 border-t border-neutral-200 pt-6 dark:border-neutral-800">
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  void signInWithPasskey({ autoFill: false });
                }}
                className={secondaryButtonClass}
              >
                <BusyLabel busy={busy === "passkey"} emoji={BUTTON_EMOJI.passkey}>
                  Sign in with a passkey
                </BusyLabel>
              </button>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Add a passkey from your account page after signing in with your email address.
              </p>
            </section>
          ) : null}
        </>
      ) : (
        <OtpForm
          email={step.email}
          pending={pending}
          checking={busy === "verify"}
          onSubmit={verifyCode}
          onChangeEmail={() => {
            setError(null);
            setStep({ name: "email" });
          }}
        />
      )}
      {error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </main>
  );
}

function EmailForm({
  pending,
  sending,
  ready,
  passkeys,
  challenge,
  onSubmit,
}: {
  pending: boolean;
  /** Sending the code is the request on its way. */
  sending: boolean;
  /** True once the Turnstile challenge has passed. */
  ready: boolean;
  /** Whether the field also offers the browser's saved passkeys. */
  passkeys: boolean;
  challenge: ReactNode;
  onSubmit: (params: { email: string }) => void;
}) {
  const [email, setEmail] = useState("");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit({ email: email.trim() });
  };

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        Enter your email address and we will send you an 8-digit sign-in code.
      </p>
      <label className="flex flex-col gap-1 text-sm">
        Email address
        <input
          type="email"
          name="email"
          autoComplete={passkeys ? "email webauthn" : "email"}
          required
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
          }}
          className={inputClass}
        />
      </label>
      {challenge}
      <button type="submit" disabled={pending || !ready} className={primaryButtonClass}>
        <BusyLabel busy={sending} emoji={BUTTON_EMOJI.sendCode}>
          Send code
        </BusyLabel>
      </button>
      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        New here? Signing in creates your account.
      </p>
    </form>
  );
}

/**
 * The code step. It asks for no Turnstile challenge (sending the code already
 * did). A new code is had by going back to the email step (there is no resend).
 */
function OtpForm({
  email,
  pending,
  checking,
  onSubmit,
  onChangeEmail,
}: {
  email: string;
  pending: boolean;
  /** Checking the code is the request on its way. */
  checking: boolean;
  onSubmit: (params: { email: string; otp: string }) => void;
  /** Back to the email step, to send a code again or to another address. */
  onChangeEmail: () => void;
}) {
  const [otp, setOtp] = useState("");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit({ email, otp });
  };

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        We sent an 8-digit code to <span className="font-medium">{email}</span>. Enter it below to
        sign in.
      </p>
      <label className="flex flex-col gap-1 text-sm">
        Sign-in code
        <input
          type="text"
          name="otp"
          inputMode="numeric"
          // Shown as 1234-5678; the hyphen is put in for the user and left
          // out of the code sent, so typing or pasting either form works.
          pattern="[0-9]{4}-[0-9]{4}"
          maxLength={OTP_LENGTH + 1}
          autoComplete="one-time-code"
          required
          value={formatOtp(otp)}
          onChange={(event) => {
            setOtp(normalizeOtp(event.target.value));
          }}
          className={`${inputClass} text-center text-2xl tracking-[0.5em]`}
        />
      </label>
      <button
        type="submit"
        disabled={pending || otp.length !== OTP_LENGTH}
        className={primaryButtonClass}
      >
        <BusyLabel busy={checking} emoji={BUTTON_EMOJI.signIn}>
          Sign in
        </BusyLabel>
      </button>
      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        No code, or the wrong address? Go back to the email step to send a new one.
      </p>
      <button
        type="button"
        className={`${linkButtonClass} self-start`}
        disabled={pending}
        onClick={onChangeEmail}
      >
        Back to the email step
      </button>
    </form>
  );
}
