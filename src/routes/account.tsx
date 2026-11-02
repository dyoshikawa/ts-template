import { createFileRoute, redirect, useNavigate, useRouter } from "@tanstack/react-router";
import { type FormEvent, useEffect, useState } from "react";

import { LanguageSwitcher } from "../components/language-switcher";
import { NotificationSettings } from "../components/notification-settings";
import { BusyLabel } from "../components/spinner";
import { Turnstile } from "../components/turnstile";
import { BUTTON_EMOJI, dangerButtonClass, secondaryButtonClass } from "../components/ui";
import { useI18n } from "../i18n/i18n-context";
import { pageTitle } from "../i18n/page-title";
import { deleteAccount, getTurnstileConfig, listPasskeys } from "../lib/account-functions";
import { loadAuthClient, preloadAuthClient } from "../lib/load-auth-client";
import { addPasskey } from "../lib/passkey-actions";
import { usePasskeysSupported } from "../lib/passkey-browser";
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
  head: ({ match }) => ({
    meta: [
      { title: pageTitle({ language: match.context.language, page: (t) => t.account.title }) },
    ],
  }),
  component: AccountPage,
});

function AccountPage() {
  const { session } = Route.useRouteContext();
  const { turnstile, vapidPublicKey, passkeys } = Route.useLoaderData();
  const router = useRouter();
  const navigate = useNavigate();
  const { t } = useI18n();
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
      setError(t.account.close.failed);
      setPending(false);
      setToken(null);
    }
  };

  return (
    <main className="mx-auto flex max-w-sm flex-col gap-8 p-4 sm:p-8">
      <section className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">{t.account.title}</h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">{session?.user.email}</p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t.language.label}</h2>
        <LanguageSwitcher />
      </section>

      {passkeys ? <PasskeySettings passkeys={passkeys.passkeys} canAdd={passkeys.canAdd} /> : null}

      <NotificationSettings vapidPublicKey={vapidPublicKey} />

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">{t.account.close.title}</h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">{t.account.close.body}</p>
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
            {t.account.close.understand}
          </label>
          {understood ? (
            <Turnstile config={turnstile} action="delete-account" onToken={setToken} />
          ) : null}
          <button
            type="submit"
            disabled={!understood || !token || pending}
            className={dangerButtonClass}
          >
            <BusyLabel busy={pending} emoji={BUTTON_EMOJI.delete}>
              {t.account.close.button}
            </BusyLabel>
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

const passkeyDateFormats = new Map<string, Intl.DateTimeFormat>();

/**
 * A passkey's date in `locale`, with the format made on first use: building
 * an `Intl.DateTimeFormat` loads the locale data, which a page without
 * passkeys (and the module's load in the Worker) need not pay for.
 */
function formatPasskeyDate({ date, locale }: { date: Date; locale: string }): string {
  let format = passkeyDateFormats.get(locale);
  if (!format) {
    // A fixed time zone, so the server render and the browser agree.
    format = new Intl.DateTimeFormat(locale, { timeZone: "UTC", dateStyle: "medium" });
    passkeyDateFormats.set(locale, format);
  }
  return format.format(date);
}

/**
 * The user's passkeys: add one on this device, or delete one. Shown on the
 * hosts that offer passkeys only (the loader's `passkeys` is null elsewhere).
 * Adding needs a sign-in within the last day (`canAdd`); sessions last much
 * longer, so an older one is told to sign in by email again first.
 */
function PasskeySettings({ passkeys, canAdd }: { passkeys: PasskeyRow[]; canAdd: boolean }) {
  const router = useRouter();
  const { t, locale } = useI18n();
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
    const result = await addPasskey({ t });
    if (result.status === "ok") {
      await router.invalidate();
      setStatus({ ok: true, text: t.passkeys.addedOk });
    } else if (result.status === "failed") {
      setStatus({ ok: false, text: result.message });
    }
    setBusy(null);
  };

  const remove = async (passkey: PasskeyRow) => {
    const label = passkeyLabel({ name: passkey.name, unnamed: t.passkeys.unnamed });
    if (!window.confirm(t.passkeys.deleteConfirm({ label }))) {
      return;
    }
    setBusy({ action: "delete", id: passkey.id });
    setStatus(null);
    const authClient = await loadAuthClient();
    const { error } = authClient
      ? await authClient.passkey.deletePasskey({ id: passkey.id })
      : { error: true };
    if (error) {
      setStatus({ ok: false, text: t.passkeys.deleteFailed });
    } else {
      await router.invalidate();
      setStatus({ ok: true, text: t.passkeys.deleted({ label }) });
    }
    setBusy(null);
  };

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">{t.passkeys.title}</h2>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">{t.passkeys.intro}</p>
      {passkeys.length > 0 ? (
        <ul className="flex flex-col divide-y divide-neutral-200 rounded-lg border border-neutral-300 dark:divide-neutral-800 dark:border-neutral-700">
          {passkeys.map((passkey) => {
            const label = passkeyLabel({ name: passkey.name, unnamed: t.passkeys.unnamed });
            return (
              <li
                key={passkey.id}
                className="flex items-center justify-between gap-3 py-1 pr-1 pl-3"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm">{label}</span>
                  {passkey.createdAt ? (
                    <span className="text-xs text-neutral-500 dark:text-neutral-400">
                      {t.passkeys.added({
                        date: formatPasskeyDate({ date: passkey.createdAt, locale }),
                      })}
                    </span>
                  ) : null}
                </div>
                <button
                  type="button"
                  disabled={pending}
                  aria-label={t.passkeys.deleteLabel({ label })}
                  className="min-h-11 shrink-0 px-3 text-sm text-red-700 underline disabled:opacity-50 dark:text-red-400"
                  onClick={() => {
                    void remove(passkey);
                  }}
                >
                  <BusyLabel
                    busy={busy?.action === "delete" && busy.id === passkey.id}
                    emoji={BUTTON_EMOJI.delete}
                  >
                    {t.passkeys.delete}
                  </BusyLabel>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">{t.passkeys.none}</p>
      )}
      {!supported ? (
        <p className="text-xs text-neutral-500 dark:text-neutral-400">{t.passkeys.unsupported}</p>
      ) : canAdd ? (
        <button
          type="button"
          disabled={pending}
          className={`${secondaryButtonClass} self-start`}
          onClick={() => {
            void add();
          }}
        >
          <BusyLabel busy={busy?.action === "add"} emoji={BUTTON_EMOJI.passkey}>
            {t.passkeys.addOnThisDevice}
          </BusyLabel>
        </button>
      ) : (
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          {t.passkeys.needsFreshSignIn}
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
