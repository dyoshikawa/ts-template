import { createFileRoute, redirect, useNavigate, useRouter } from "@tanstack/react-router";
import { type FormEvent, type ReactNode, useState } from "react";

import { Turnstile } from "../components/turnstile";
import { inputClass, linkButtonClass, primaryButtonClass } from "../components/ui";
import { getTurnstileSiteKey } from "../lib/account-functions";
import { authClient } from "../lib/auth-client";

export const Route = createFileRoute("/login")({
  beforeLoad: ({ context }) => {
    if (context.session) {
      throw redirect({ to: "/" });
    }
  },
  loader: () => getTurnstileSiteKey(),
  component: LoginPage,
});

type Step = { name: "email" } | { name: "otp"; email: string };

function LoginPage() {
  const router = useRouter();
  const navigate = useNavigate();
  const { turnstileSiteKey } = Route.useLoaderData();
  const [step, setStep] = useState<Step>({ name: "email" });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // Sending a code needs a passed Turnstile challenge, asked once on the email
  // step only. A token is single-use, so the widget is remounted (fresh
  // token) after every send, in case the user comes back to send again.
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [captchaRound, setCaptchaRound] = useState(0);

  const sendCode = async ({ email }: { email: string }) => {
    if (!captcha) {
      setError("Wait a moment for the check to finish.");
      return;
    }
    setPending(true);
    setError(null);
    const { error: sendError } = await authClient.emailOtp.sendVerificationOtp(
      { email, type: "sign-in" },
      { headers: { "x-captcha-response": captcha } },
    );
    setCaptcha(null);
    setCaptchaRound((round) => round + 1);
    setPending(false);
    if (sendError) {
      setError(sendError.message ?? "Could not send the code. Please try again.");
      return;
    }
    setStep({ name: "otp", email });
  };

  const challenge = (
    <Turnstile key={captchaRound} siteKey={turnstileSiteKey} onToken={setCaptcha} />
  );

  const verifyCode = async ({ email, otp }: { email: string; otp: string }) => {
    setPending(true);
    setError(null);
    const { error: verifyError } = await authClient.signIn.emailOtp({ email, otp });
    setPending(false);
    if (verifyError) {
      setError(verifyError.message ?? "That code is not right. Please try again.");
      return;
    }
    await router.invalidate();
    await navigate({ to: "/" });
  };

  return (
    <main className="mx-auto flex max-w-sm flex-col gap-6 p-4 sm:p-8">
      <h1 className="text-2xl font-bold">Sign in</h1>
      {step.name === "email" ? (
        <EmailForm
          pending={pending}
          ready={captcha !== null}
          challenge={challenge}
          onSubmit={sendCode}
        />
      ) : (
        <OtpForm
          email={step.email}
          pending={pending}
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
  ready,
  challenge,
  onSubmit,
}: {
  pending: boolean;
  /** True once the Turnstile challenge has passed. */
  ready: boolean;
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
        Enter your email address and we will send you a 6-digit sign-in code.
      </p>
      <label className="flex flex-col gap-1 text-sm">
        Email address
        <input
          type="email"
          name="email"
          autoComplete="email"
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
        {pending ? "Sending…" : "Send code"}
      </button>
      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        New here? Signing in creates your account.
      </p>
    </form>
  );
}

/**
 * The code step. No Turnstile here: the challenge was passed on the email
 * step, and a new code is had by going back to it (there is no resend).
 */
function OtpForm({
  email,
  pending,
  onSubmit,
  onChangeEmail,
}: {
  email: string;
  pending: boolean;
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
        We sent a 6-digit code to <span className="font-medium">{email}</span>. Enter it below to
        sign in.
      </p>
      <label className="flex flex-col gap-1 text-sm">
        Sign-in code
        <input
          type="text"
          name="otp"
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={6}
          autoComplete="one-time-code"
          required
          value={otp}
          onChange={(event) => {
            setOtp(event.target.value.replaceAll(/\D/g, ""));
          }}
          className={`${inputClass} text-center text-2xl tracking-[0.5em]`}
        />
      </label>
      <button type="submit" disabled={pending || otp.length !== 6} className={primaryButtonClass}>
        {pending ? "Checking…" : "Sign in"}
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
