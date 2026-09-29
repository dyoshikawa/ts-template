import { useEffect, useState } from "react";

import {
  type PushSupport,
  disableNotifications,
  enableNotifications,
  pushSupport,
  resyncSubscription,
} from "../lib/push-client";
import { sendTestNotification } from "../lib/push-functions";
import { primaryButtonClass, secondaryButtonClass } from "./ui";

type State =
  | { name: "checking" }
  | { name: "blocked"; support: Exclude<PushSupport, "ready"> }
  | { name: "denied" }
  | { name: "off" }
  | { name: "on" };

const BLOCKED_MESSAGES: Record<Exclude<PushSupport, "ready">, string> = {
  unsupported: "This browser cannot receive push notifications.",
  "install-first":
    "On iPhone and iPad, add this app to your Home Screen first, then turn notifications on from the installed app.",
  "no-worker":
    "Notifications need the service worker, which only the built app registers (pnpm dev:cf or a deployment).",
};

/**
 * Turning push notifications on and off for this device, and sending a test
 * one. `vapidPublicKey` is empty while the server has no VAPID keys.
 */
export function NotificationSettings({ vapidPublicKey }: { vapidPublicKey: string }) {
  const [state, setState] = useState<State>({ name: "checking" });
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (vapidPublicKey === "") {
      return;
    }
    let cancelled = false;
    const check = async (): Promise<State> => {
      const support = await pushSupport();
      if (support !== "ready") {
        return { name: "blocked", support };
      }
      if (Notification.permission === "denied") {
        return { name: "denied" };
      }
      return (await resyncSubscription()) ? { name: "on" } : { name: "off" };
    };
    check()
      .catch((): State => ({ name: "off" }))
      .then((next) => {
        if (!cancelled) {
          setState(next);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [vapidPublicKey]);

  const run = async (action: () => Promise<void>) => {
    setPending(true);
    setMessage(null);
    try {
      await action();
    } catch {
      setMessage("Something went wrong. Reload the page and try again.");
    } finally {
      setPending(false);
    }
  };

  const turnOn = () =>
    run(async () => {
      const result = await enableNotifications(vapidPublicKey);
      setState(result === "enabled" ? { name: "on" } : { name: "denied" });
    });

  const turnOff = () =>
    run(async () => {
      await disableNotifications();
      setState({ name: "off" });
    });

  const sendTest = () =>
    run(async () => {
      const result = await sendTestNotification();
      if (!result.ok) {
        setMessage("Too many test notifications. Wait a minute and try again.");
        return;
      }
      setMessage(
        result.sent > 0
          ? `Sent to ${result.sent} device${result.sent === 1 ? "" : "s"}.`
          : "No device accepted the notification.",
      );
    });

  return (
    <section className="flex flex-col gap-4" aria-labelledby="notifications-heading">
      <h2 id="notifications-heading" className="text-lg font-semibold">
        Notifications
      </h2>
      <NotificationBody
        state={vapidPublicKey === "" ? null : state}
        pending={pending}
        onTurnOn={turnOn}
        onTurnOff={turnOff}
        onSendTest={sendTest}
      />
      {message ? (
        <output className="block text-sm text-neutral-600 dark:text-neutral-400">{message}</output>
      ) : null}
    </section>
  );
}

const noteClass = "text-sm text-neutral-600 dark:text-neutral-400";

function NotificationBody({
  state,
  pending,
  onTurnOn,
  onTurnOff,
  onSendTest,
}: {
  /** `null` when the server has push notifications switched off. */
  state: State | null;
  pending: boolean;
  onTurnOn: () => void;
  onTurnOff: () => void;
  onSendTest: () => void;
}) {
  if (state === null) {
    return <p className={noteClass}>Push notifications are not configured on this server.</p>;
  }
  switch (state.name) {
    case "checking": {
      return <p className={noteClass}>Checking this device…</p>;
    }
    case "blocked": {
      return <p className={noteClass}>{BLOCKED_MESSAGES[state.support]}</p>;
    }
    case "denied": {
      return (
        <p className={noteClass}>
          Notifications are blocked for this site. Allow them in the browser&apos;s site settings,
          then reload the page.
        </p>
      );
    }
    case "off": {
      return (
        <>
          <p className={noteClass}>Get notified on this device.</p>
          <button
            type="button"
            disabled={pending}
            onClick={onTurnOn}
            className={primaryButtonClass}
          >
            {pending ? "Turning on…" : "Turn on notifications"}
          </button>
        </>
      );
    }
    case "on": {
      return (
        <>
          <p className={noteClass}>Notifications are on for this device.</p>
          <button
            type="button"
            disabled={pending}
            onClick={onSendTest}
            className={secondaryButtonClass}
          >
            Send a test notification
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={onTurnOff}
            className={secondaryButtonClass}
          >
            Turn off notifications
          </button>
        </>
      );
    }
  }
}
