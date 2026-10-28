import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { preloadAuthClient } from "../lib/load-auth-client";
import { addPasskey } from "../lib/passkey-actions";
import {
  declinePasskeyOffer,
  endPasskeyOffer,
  showPasskeyOffer,
  usePasskeyOfferPending,
} from "../lib/passkey-browser";
import { primaryButtonClass, secondaryButtonClass } from "./ui";

type OfferState =
  | { name: "open"; error: string | null }
  | { name: "pending" }
  | { name: "done" }
  | { name: "closed" };

/**
 * Offers a passkey once after an email sign-in (the login page asks for it
 * on hosts that offer passkeys), on the home page. Leaving the page without
 * answering ends the offer too; "Not now" stops it on this device for good.
 * The account page can always add one.
 */
export function PasskeyOffer() {
  const offered = usePasskeyOfferPending();
  const [state, setState] = useState<OfferState>({ name: "open", error: null });

  // Shown on one visit of the home page only.
  useEffect(() => showPasskeyOffer(), []);

  // Fetched ahead of the press: see `preloadAuthClient`.
  useEffect(() => {
    if (offered) {
      preloadAuthClient();
    }
  }, [offered]);

  if (state.name === "closed" || (!offered && state.name !== "done")) {
    return null;
  }

  const register = async () => {
    setState({ name: "pending" });
    const result = await addPasskey();
    if (result.status === "ok") {
      // Ends the offer, but the card stays to say so until closed.
      setState({ name: "done" });
      endPasskeyOffer();
      return;
    }
    setState({ name: "open", error: result.status === "failed" ? result.message : null });
  };

  return (
    <section
      aria-labelledby="passkey-offer-heading"
      className="flex flex-col gap-3 rounded-xl border border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950"
    >
      {state.name === "done" ? (
        <>
          <h2 id="passkey-offer-heading" className="font-semibold">
            🔑 Passkey added
          </h2>
          <p className="text-sm">
            Next time, choose "Sign in with a passkey" on the sign-in page instead of waiting for a
            code. You can review and delete your passkeys on your{" "}
            <Link to="/account" className="underline">
              account page
            </Link>
            .
          </p>
          <button
            type="button"
            className={`${secondaryButtonClass} self-start`}
            onClick={() => {
              setState({ name: "closed" });
            }}
          >
            Close
          </button>
        </>
      ) : (
        <>
          <h2 id="passkey-offer-heading" className="font-semibold">
            🔑 Sign in with a passkey next time?
          </h2>
          <p className="text-sm">
            Use this device's fingerprint, face or screen lock to sign in without waiting for an
            email code. Signing in by email keeps working as before.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={state.name === "pending"}
              className={primaryButtonClass}
              onClick={() => {
                void register();
              }}
            >
              {state.name === "pending" ? "Adding…" : "Add a passkey"}
            </button>
            <button
              type="button"
              disabled={state.name === "pending"}
              className={secondaryButtonClass}
              onClick={() => {
                declinePasskeyOffer();
              }}
            >
              Not now
            </button>
          </div>
          {state.name === "open" && state.error ? (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {state.error}
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
