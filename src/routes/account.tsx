import { createFileRoute, redirect, useNavigate, useRouter } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";

import { NotificationSettings } from "../components/notification-settings";
import { Turnstile } from "../components/turnstile";
import { dangerButtonClass } from "../components/ui";
import { deleteAccount, getTurnstileSiteKey } from "../lib/account-functions";
import { APP_NAME } from "../lib/app";
import { disableNotifications } from "../lib/push-client";
import { getPushConfig } from "../lib/push-functions";

export const Route = createFileRoute("/account")({
  beforeLoad: ({ context }) => {
    if (!context.session) {
      throw redirect({ to: "/login" });
    }
  },
  loader: async () => {
    const [{ turnstileSiteKey }, { vapidPublicKey }] = await Promise.all([
      getTurnstileSiteKey(),
      getPushConfig(),
    ]);
    return { turnstileSiteKey, vapidPublicKey };
  },
  head: () => ({ meta: [{ title: `Account — ${APP_NAME}` }] }),
  component: AccountPage,
});

function AccountPage() {
  const { session } = Route.useRouteContext();
  const { turnstileSiteKey, vapidPublicKey } = Route.useLoaderData();
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
          {understood ? <Turnstile siteKey={turnstileSiteKey} onToken={setToken} /> : null}
          <button
            type="submit"
            disabled={!understood || !token || pending}
            className={dangerButtonClass}
          >
            {pending ? "Deleting…" : "Close account and delete all data"}
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
