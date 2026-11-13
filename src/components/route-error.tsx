import { type ErrorComponentProps, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";

import { useI18n } from "../i18n/i18n-context";
import { classifyFailure, failureText } from "../lib/failure";
import { BusyLabel, Emoji } from "./spinner";
import { BUTTON_EMOJI, secondaryButtonClass } from "./ui";

const linkClass =
  "flex min-h-11 items-center justify-center gap-2 rounded-lg border border-neutral-300 px-4 text-base hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800";

/**
 * A page whose data or code failed to load: says which kind of failure it
 * was (offline, signed out, the server…) in the page's language, instead of
 * the router's bare English "Something went wrong!", and offers to load it
 * again — or to sign in, when the session is what is missing.
 */
export function RouteError({ error, reset }: ErrorComponentProps) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const failure = classifyFailure(error);

  const loadAgain = async () => {
    setLoading(true);
    try {
      // Reloads the matches and resets this boundary with them.
      await router.invalidate();
      reset();
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto flex max-w-sm flex-col gap-4 p-4 sm:p-8">
      <h1 className="text-2xl font-bold">{t.routeError.title}</h1>
      <p role="alert" className="text-sm text-red-700 dark:text-red-400">
        {failureText({ failure, t, locale })}
      </p>
      <div className="flex flex-col gap-2">
        {failure.kind === "signedOut" ? (
          <Link to="/login" className={linkClass}>
            <Emoji>{BUTTON_EMOJI.signIn}</Emoji>
            {t.common.signIn}
          </Link>
        ) : (
          <button
            type="button"
            disabled={loading}
            className={secondaryButtonClass}
            onClick={() => {
              void loadAgain();
            }}
          >
            <BusyLabel busy={loading} emoji={BUTTON_EMOJI.retry}>
              {t.routeError.loadAgain}
            </BusyLabel>
          </button>
        )}
        {/* Repeats the header's logo link on purpose: this page is a dead
            end, and the way out belongs beside the message. */}
        <Link to="/" className={linkClass}>
          <Emoji>{BUTTON_EMOJI.home}</Emoji>
          {t.common.home}
        </Link>
      </div>
    </main>
  );
}

/** An address no page answers to, in the page's language instead of the router's "Not Found". */
export function RouteNotFound() {
  const { t } = useI18n();
  return (
    <main className="mx-auto flex max-w-sm flex-col gap-4 p-4 sm:p-8">
      <h1 className="text-2xl font-bold">{t.routeError.notFoundTitle}</h1>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">{t.routeError.notFoundBody}</p>
      {/* Repeats the header's logo link on purpose, as on RouteError. */}
      <Link to="/" className={linkClass}>
        <Emoji>{BUTTON_EMOJI.home}</Emoji>
        {t.common.home}
      </Link>
    </main>
  );
}
