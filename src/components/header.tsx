import { Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";

import { useI18n } from "../i18n/i18n-context";
import { APP_NAME } from "../lib/app";
import { type SessionData } from "../lib/auth-functions";
import { classifyFailure, failureNotice } from "../lib/failure";
import { loadAuthClient } from "../lib/load-auth-client";
import { disableNotifications } from "../lib/push-client";
import { fetchOrUnreachable } from "../lib/unreachable";
import { Drawer } from "./drawer";
import { InstallButton } from "./install-button";
import { LanguageSwitcher } from "./language-switcher";
import { Logo } from "./logo";
import { BusyLabel, Emoji } from "./spinner";
import { BUTTON_EMOJI } from "./ui";

const menuLinkClass =
  "flex min-h-12 items-center gap-3 px-4 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800";

export function Header({ session }: { session: SessionData }) {
  const router = useRouter();
  const { t, locale } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  // Why the last sign-out failed, shown under its button until the next try.
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const close = () => {
    setMenuOpen(false);
    setSignOutError(null);
  };

  // The menu stays open with a spinner on the button until the session has
  // ended, so the user sees the sign-out happening.
  const signOut = async () => {
    setSigningOut(true);
    setSignOutError(null);
    // Fetched first, so a failed fetch does not leave notifications switched
    // off while the session goes on; without the client, sign out through
    // the endpoint it would call.
    const authClient = await loadAuthClient();
    // Before the session ends: the server forgets this device, so the next
    // person signed in here does not get this user's notifications. Signing
    // out goes ahead even if the browser fails to unsubscribe: keeping the
    // session would not bring the subscription back.
    await disableNotifications().catch(() => undefined);
    const { error } = authClient ? await authClient.signOut() : await signOutWithoutClient();
    // A session that had already ended elsewhere is signed out all the same.
    if (error && classifyFailure(error).kind !== "signedOut") {
      setSignOutError(failureNotice({ action: t.common.signOutFailed, error, t, locale }));
      setSigningOut(false);
      return;
    }
    try {
      await router.invalidate();
    } catch {
      // Signed out either way: load the page afresh rather than leave the
      // button spinning.
      window.location.reload();
      return;
    }
    setSigningOut(false);
    close();
  };

  return (
    <header className="flex min-h-14 items-center justify-between gap-3 border-b border-neutral-200 dark:border-neutral-800 px-2 sm:px-4">
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label={t.common.menu}
          aria-expanded={menuOpen}
          onClick={() => {
            setMenuOpen(true);
          }}
          className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-xl hover:bg-neutral-100 dark:hover:bg-neutral-800"
        >
          ☰
        </button>
        <Link to="/" aria-label={t.common.home} className="flex min-h-11 items-center">
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
          {t.common.signIn}
        </Link>
      )}

      <Drawer open={menuOpen} title={APP_NAME} closeLabel={t.common.closeMenu} onClose={close}>
        {session ? (
          <>
            <p className="truncate px-4 py-3 text-xs text-neutral-600 dark:text-neutral-400">
              {session.user.email}
            </p>
            <Link to="/" onClick={close} className={menuLinkClass}>
              <Emoji>{BUTTON_EMOJI.home}</Emoji>
              {t.common.home}
            </Link>
            <Link to="/account" onClick={close} className={menuLinkClass}>
              <Emoji>{BUTTON_EMOJI.account}</Emoji>
              {t.common.account}
            </Link>
            <InstallButton className={`${menuLinkClass} w-full`} />
            <LanguageSwitcher className="px-4 py-2" />
            <div className="mt-auto border-t border-neutral-200 dark:border-neutral-800">
              <button
                type="button"
                disabled={signingOut}
                onClick={signOut}
                className={`${menuLinkClass} w-full disabled:opacity-50`}
              >
                <BusyLabel busy={signingOut} emoji={BUTTON_EMOJI.signOut}>
                  {t.common.signOut}
                </BusyLabel>
              </button>
              {signOutError ? (
                <p role="alert" className="px-4 pb-3 text-sm text-red-600 dark:text-red-400">
                  {signOutError}
                </p>
              ) : null}
            </div>
          </>
        ) : (
          <>
            <Link to="/" onClick={close} className={menuLinkClass}>
              <Emoji>{BUTTON_EMOJI.home}</Emoji>
              {t.common.home}
            </Link>
            <Link to="/login" onClick={close} className={menuLinkClass}>
              <Emoji>{BUTTON_EMOJI.signIn}</Emoji>
              {t.common.signIn}
            </Link>
            <InstallButton className={`${menuLinkClass} w-full`} />
            <LanguageSwitcher className="px-4 py-2" />
          </>
        )}
      </Drawer>
    </header>
  );
}

/**
 * Signs out through the endpoint Better Auth's client would call, for when
 * the client's chunk could not be fetched; answers like the client does.
 */
async function signOutWithoutClient(): Promise<{
  error: { status: number; code?: unknown } | null;
}> {
  const response = await fetchOrUnreachable("/api/auth/sign-out", { method: "POST" });
  if (response.ok) {
    return { error: null };
  }
  const body: unknown = await response.json().catch(() => null);
  const code =
    typeof body === "object" && body !== null ? (body as { code?: unknown }).code : undefined;
  return { error: { status: response.status, code } };
}
