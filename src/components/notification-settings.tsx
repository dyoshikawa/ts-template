import { useEffect, useState } from "react";

import { useI18n } from "../i18n/i18n-context";
import { type Messages } from "../i18n/messages";
import {
  type PushSupport,
  disableNotifications,
  enableNotifications,
  pushSupport,
  resyncSubscription,
} from "../lib/push-client";
import { sendTestNotification } from "../lib/push-functions";
import { BusyLabel } from "./spinner";
import { BUTTON_EMOJI, primaryButtonClass, secondaryButtonClass } from "./ui";

/** The buttons that wait on the server or the browser's push service. */
type Action = "on" | "off" | "test";

type State =
  | { name: "checking" }
  | { name: "blocked"; support: Exclude<PushSupport, "ready"> }
  | { name: "denied" }
  | { name: "off" }
  | { name: "on" };

/** Why this device cannot turn notifications on, by what `pushSupport` found. */
const BLOCKED_MESSAGES = {
  unsupported: "unsupported",
  "install-first": "installFirst",
  "no-worker": "noWorker",
} as const satisfies Record<Exclude<PushSupport, "ready">, keyof Messages["notifications"]>;

/**
 * Turning push notifications on and off for this device, and sending a test
 * one. `vapidPublicKey` is empty while the server has no VAPID keys.
 */
export function NotificationSettings({ vapidPublicKey }: { vapidPublicKey: string }) {
  const { t, locale } = useI18n();
  const [state, setState] = useState<State>({ name: "checking" });
  // The action on its way: its button shows a spinner, every button waits.
  const [busy, setBusy] = useState<Action | null>(null);
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

  const run = async (name: Action, action: () => Promise<void>) => {
    setBusy(name);
    setMessage(null);
    try {
      await action();
    } catch {
      setMessage(t.notifications.failed);
    } finally {
      setBusy(null);
    }
  };

  const turnOn = () =>
    run("on", async () => {
      const result = await enableNotifications(vapidPublicKey);
      setState(result === "enabled" ? { name: "on" } : { name: "denied" });
    });

  const turnOff = () =>
    run("off", async () => {
      await disableNotifications();
      setState({ name: "off" });
    });

  const sendTest = () =>
    run("test", async () => {
      const result = await sendTestNotification();
      if (!result.ok) {
        setMessage(t.notifications.rateLimited);
        return;
      }
      setMessage(
        result.sent > 0
          ? t.notifications.sent({
              count: new Intl.NumberFormat(locale).format(result.sent),
              plural: new Intl.PluralRules(locale).select(result.sent),
            })
          : t.notifications.noneAccepted,
      );
    });

  return (
    <section className="flex flex-col gap-4" aria-labelledby="notifications-heading">
      <h2 id="notifications-heading" className="text-lg font-semibold">
        {t.notifications.title}
      </h2>
      <NotificationBody
        state={vapidPublicKey === "" ? null : state}
        busy={busy}
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
  busy,
  onTurnOn,
  onTurnOff,
  onSendTest,
}: {
  /** `null` when the server has push notifications switched off. */
  state: State | null;
  busy: Action | null;
  onTurnOn: () => void;
  onTurnOff: () => void;
  onSendTest: () => void;
}) {
  const { t } = useI18n();
  if (state === null) {
    return <p className={noteClass}>{t.notifications.notConfigured}</p>;
  }
  switch (state.name) {
    case "checking": {
      return <p className={noteClass}>{t.notifications.checking}</p>;
    }
    case "blocked": {
      return <p className={noteClass}>{t.notifications[BLOCKED_MESSAGES[state.support]]}</p>;
    }
    case "denied": {
      return <p className={noteClass}>{t.notifications.denied}</p>;
    }
    case "off": {
      return (
        <>
          <p className={noteClass}>{t.notifications.offNote}</p>
          <button
            type="button"
            disabled={busy !== null}
            onClick={onTurnOn}
            className={primaryButtonClass}
          >
            <BusyLabel busy={busy === "on"} emoji={BUTTON_EMOJI.notificationsOn}>
              {t.notifications.turnOn}
            </BusyLabel>
          </button>
        </>
      );
    }
    case "on": {
      return (
        <>
          <p className={noteClass}>{t.notifications.onNote}</p>
          <button
            type="button"
            disabled={busy !== null}
            onClick={onSendTest}
            className={secondaryButtonClass}
          >
            <BusyLabel busy={busy === "test"} emoji={BUTTON_EMOJI.testNotification}>
              {t.notifications.sendTest}
            </BusyLabel>
          </button>
          <button
            type="button"
            disabled={busy !== null}
            onClick={onTurnOff}
            className={secondaryButtonClass}
          >
            <BusyLabel busy={busy === "off"} emoji={BUTTON_EMOJI.notificationsOff}>
              {t.notifications.turnOff}
            </BusyLabel>
          </button>
        </>
      );
    }
  }
}
