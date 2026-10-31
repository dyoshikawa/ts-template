import { Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";

import { APP_NAME } from "../lib/app";
import { type SessionData } from "../lib/auth-functions";
import { loadAuthClient } from "../lib/load-auth-client";
import { disableNotifications } from "../lib/push-client";
import { Drawer } from "./drawer";
import { InstallButton } from "./install-button";
import { Logo } from "./logo";
import { BusyLabel, Emoji } from "./spinner";
import { BUTTON_EMOJI } from "./ui";

const menuLinkClass =
  "flex min-h-12 items-center gap-3 px-4 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800";

export function Header({ session }: { session: SessionData }) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const close = () => {
    setMenuOpen(false);
  };

  // The menu stays open with a spinner on the button until the session has
  // ended, so the user sees the sign-out happening.
  const signOut = async () => {
    setSigningOut(true);
    // Fetched first, so a failed fetch does not leave notifications switched
    // off while the session goes on; without the client, sign out through
    // the endpoint it would call.
    const authClient = await loadAuthClient();
    // Before the session ends: the server forgets this device, so the next
    // person signed in here does not get this user's notifications.
    await disableNotifications().catch(() => {});
    if (authClient) {
      await authClient.signOut();
    } else {
      await fetch("/api/auth/sign-out", { method: "POST" }).catch(() => {});
    }
    await router.invalidate();
    setSigningOut(false);
    close();
  };

  return (
    <header className="flex min-h-14 items-center justify-between gap-3 border-b border-neutral-200 dark:border-neutral-800 px-2 sm:px-4">
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label="Menu"
          aria-expanded={menuOpen}
          onClick={() => {
            setMenuOpen(true);
          }}
          className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-xl hover:bg-neutral-100 dark:hover:bg-neutral-800"
        >
          ☰
        </button>
        <Link to="/" aria-label="Home" className="flex min-h-11 items-center">
          <Logo size={32} />
        </Link>
      </div>
      {/* Also in the menu, on purpose: the bar shows who is signed in (or that
          nobody is) on every screen and is the one-tap way there; the menu
          lists every destination so it reads complete. */}
      {session ? (
        <Link
          to="/account"
          className="flex min-h-11 min-w-0 items-center truncate px-2 text-sm text-neutral-600 underline dark:text-neutral-400"
        >
          {session.user.email}
        </Link>
      ) : (
        <Link to="/login" className="flex min-h-11 items-center px-2 text-sm underline">
          Sign in
        </Link>
      )}

      <Drawer open={menuOpen} title={APP_NAME} closeLabel="Close menu" onClose={close}>
        {session ? (
          <>
            <p className="truncate px-4 py-3 text-xs text-neutral-600 dark:text-neutral-400">
              {session.user.email}
            </p>
            <Link to="/" onClick={close} className={menuLinkClass}>
              <Emoji>{BUTTON_EMOJI.home}</Emoji>
              Home
            </Link>
            <Link to="/account" onClick={close} className={menuLinkClass}>
              <Emoji>{BUTTON_EMOJI.account}</Emoji>
              Account
            </Link>
            <InstallButton className={`${menuLinkClass} w-full`} />
            <div className="mt-auto border-t border-neutral-200 dark:border-neutral-800">
              <button
                type="button"
                disabled={signingOut}
                onClick={signOut}
                className={`${menuLinkClass} w-full disabled:opacity-50`}
              >
                <BusyLabel busy={signingOut} emoji={BUTTON_EMOJI.signOut}>
                  Sign out
                </BusyLabel>
              </button>
            </div>
          </>
        ) : (
          <>
            <Link to="/" onClick={close} className={menuLinkClass}>
              <Emoji>{BUTTON_EMOJI.home}</Emoji>
              Home
            </Link>
            <Link to="/login" onClick={close} className={menuLinkClass}>
              <Emoji>{BUTTON_EMOJI.signIn}</Emoji>
              Sign in
            </Link>
            <InstallButton className={`${menuLinkClass} w-full`} />
          </>
        )}
      </Drawer>
    </header>
  );
}
