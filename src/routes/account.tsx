import { createFileRoute, redirect, useNavigate, useRouter } from "@tanstack/react-router";
import { type FormEvent, useEffect, useState } from "react";

import { NotificationSettings } from "../components/notification-settings";
import { BusyLabel } from "../components/spinner";
import { Turnstile } from "../components/turnstile";
import { dangerButtonClass, secondaryButtonClass } from "../components/ui";
import { deleteAccount, getTurnstileConfig, listPasskeys } from "../lib/account-functions";
import { APP_NAME } from "../lib/app";
import { loadAuthClient, preloadAuthClient } from "../lib/load-auth-client";
import { addPasskey } from "../lib/passkey-actions";
import { PASSKEY_NEEDS_FRESH_SIGN_IN, usePasskeysSupported } from "../lib/passkey-browser";
import { passkeyLabel } from "../lib/passkey-name";
import { disableNotifications } from "../lib/push-client";
import { getPushConfig } from "../lib/push-functions";

export const Route = createFileRoute("/account")({
  beforeLoad: ({ context }) => {
    if (!context.session) {
      throw redirect({ to: "/login" });
    }
  },
  loader: async () => {
    const [{ turnstile }, { vapidPublicKey }, passkeys] = await Promise.all([
      getTurnstileConfig(),
      getPushConfig(),
      listPasskeys(),
    ]);
    return { turnstile, vapidPublicKey, passkeys };
  },
  head: () => ({ meta: [{ title: `Account — ${APP_NAME}` }] }),
  component: AccountPage,
});

function AccountPage() {
  const { session } = Route.useRouteContext();
  const { turnstile, vapidPublicKey, passkeys } = Route.useLoaderData();
  const router = useRouter();
  const navigate = useNavigate();
  const [understood, setUnderstood] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      await deleteAccount({ data: { turnstileToken: token } });
      // The server rows are gone with the account; unsubscribe the device too.
      await disableNotifications({ forgetOnServer: false }).catch(() => {});
      await router.invalidate();
      await navigate({ to: "/" });
    } catch {
      setError("Could not close the account. Reload the page and try again.");
      setPending(false);
      setToken(null);
    }
  };

  return (
    <main className="mx-auto flex max-w-sm flex-col gap-8 p-4 sm:p-8">
      <section className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">Account</h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">{session?.user.email}</p>
      </section>

      {passkeys ? <PasskeySettings passkeys={passkeys.passkeys} canAdd={passkeys.canAdd} /> : null}

      <NotificationSettings vapidPublicKey={vapidPublicKey} />

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Close account</h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Closing your account deletes it and all of its data right away. Deleted data cannot be
          recovered.
        </p>
        <form className="flex flex-col gap-4" onSubmit={close}>
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={understood}
              onChange={(event) => {
                setUnderstood(event.target.checked);
              }}
              className="size-5 accent-red-700"
            />
            I understand that all my data will be deleted and cannot be restored
          </label>
          {understood ? (
            <Turnstile config={turnstile} action="delete-account" onToken={setToken} />
          ) : null}
          <button
            type="submit"
            disabled={!understood || !token || pending}
            className={dangerButtonClass}
          >
            <BusyLabel busy={pending}>Close account and delete all data</BusyLabel>
          </button>
        </form>
        {error ? (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        ) : null}
      </section>
    </main>
  );
}

type PasskeyRow = NonNullable<Awaited<ReturnType<typeof listPasskeys>>>["passkeys"][number];

let passkeyDateFormat: Intl.DateTimeFormat | undefined;

/**
 * The format of a passkey's date, made on first use: building an
 * `Intl.DateTimeFormat` loads the locale data, which a page without
 * passkeys (and the module's load in the Worker) need not pay for.
 */
function formatPasskeyDate(date: Date): string {
  passkeyDateFormat ??= new Intl.DateTimeFormat("en-US", {
    // Fixed, so the server render and the browser agree.
    timeZone: "UTC",
    dateStyle: "medium",
  });
  return passkeyDateFormat.format(date);
}

/**
 * The user's passkeys: add one on this device, or delete one. Shown on the
 * hosts that offer passkeys only (the loader's `passkeys` is null elsewhere).
 * Adding needs a sign-in within the last day (`canAdd`); sessions last much
 * longer, so an older one is told to sign in by email again first.
 */
function PasskeySettings({ passkeys, canAdd }: { passkeys: PasskeyRow[]; canAdd: boolean }) {
  const router = useRouter();
  // What is on its way: adding, or deleting the passkey with this id. Its
  // button shows a spinner; every passkey button waits until it settles.
  const [busy, setBusy] = useState<{ action: "add" } | { action: "delete"; id: string } | null>(
    null,
  );
  const pending = busy !== null;
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const supported = usePasskeysSupported();

  // Fetched ahead of the press: see `preloadAuthClient`.
  useEffect(() => {
    if (canAdd && supported) {
      preloadAuthClient();
    }
  }, [canAdd, supported]);

  const add = async () => {
    setBusy({ action: "add" });
    setStatus(null);
    const result = await addPasskey();
    if (result.status === "ok") {
      await router.invalidate();
      setStatus({ ok: true, text: "Passkey added." });
    } else if (result.status === "failed") {
      setStatus({ ok: false, text: result.message });
    }
    setBusy(null);
  };

  const remove = async (passkey: PasskeyRow) => {
    const label = passkeyLabel(passkey);
    if (!window.confirm(`Delete "${label}"? You will no longer be able to sign in with it.`)) {
      return;
    }
    setBusy({ action: "delete", id: passkey.id });
    setStatus(null);
    const authClient = await loadAuthClient();
    const { error } = authClient
      ? await authClient.passkey.deletePasskey({ id: passkey.id })
      : { error: true };
    if (error) {
      setStatus({ ok: false, text: "Could not delete the passkey. Please try again." });
    } else {
      await router.invalidate();
      setStatus({ ok: true, text: `Deleted "${label}".` });
    }
    setBusy(null);
  };

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Passkeys</h2>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        Sign in with your fingerprint, face or screen lock instead of waiting for an email code.
        Signing in by email keeps working as before.
      </p>
      {passkeys.length > 0 ? (
        <ul className="flex flex-col divide-y divide-neutral-200 rounded-lg border border-neutral-300 dark:divide-neutral-800 dark:border-neutral-700">
          {passkeys.map((passkey) => (
            <li key={passkey.id} className="flex items-center justify-between gap-3 py-1 pr-1 pl-3">
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm">{passkeyLabel(passkey)}</span>
                {passkey.createdAt ? (
                  <span className="text-xs text-neutral-500 dark:text-neutral-400">
                    Added {formatPasskeyDate(passkey.createdAt)}
                  </span>
                ) : null}
              </div>
              <button
                type="button"
                disabled={pending}
                aria-label={`Delete "${passkeyLabel(passkey)}"`}
                className="min-h-11 shrink-0 px-3 text-sm text-red-700 underline disabled:opacity-50 dark:text-red-400"
                onClick={() => {
                  void remove(passkey);
                }}
              >
                <BusyLabel busy={busy?.action === "delete" && busy.id === passkey.id}>
                  Delete
                </BusyLabel>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">No passkeys yet.</p>
      )}
      {!supported ? (
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          This browser does not support passkeys.
        </p>
      ) : canAdd ? (
        <button
          type="button"
          disabled={pending}
          className={`${secondaryButtonClass} self-start`}
          onClick={() => {
            void add();
          }}
        >
          <BusyLabel busy={busy?.action === "add"}>🔑 Add a passkey on this device</BusyLabel>
        </button>
      ) : (
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          {PASSKEY_NEEDS_FRESH_SIGN_IN}
        </p>
      )}
      {status ? (
        <output
          className={
            status.ok
              ? "text-sm text-emerald-700 dark:text-emerald-400"
              : "text-sm text-red-600 dark:text-red-400"
          }
        >
          {status.text}
        </output>
      ) : null}
    </section>
  );
}
