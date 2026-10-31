import { createFileRoute, Link } from "@tanstack/react-router";

import { InstallButton } from "../components/install-button";
import { Logo } from "../components/logo";
import { PasskeyOffer } from "../components/passkey-offer";
import { secondaryButtonClass } from "../components/ui";
import { useI18n } from "../i18n/i18n-context";
import { APP_NAME } from "../lib/app";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const { session } = Route.useRouteContext();
  const { t } = useI18n();

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-4 sm:p-6">
      <div className="flex items-center gap-4">
        <Logo size={48} />
        <h1 className="text-2xl font-bold sm:text-3xl">{APP_NAME}</h1>
      </div>
      {session ? (
        <p className="text-neutral-600 dark:text-neutral-400">
          {t.home.signedIn.before}
          <span className="font-medium">{session.user.email}</span>
          {t.home.signedIn.afterEmail}
          <Link to="/account" className="underline">
            {t.home.signedIn.link}
          </Link>
          {t.home.signedIn.after}
        </p>
      ) : (
        <p className="text-neutral-600 dark:text-neutral-400">
          {t.home.signedOut.before}
          <Link to="/login" className="underline">
            {t.home.signedOut.link}
          </Link>
          {t.home.signedOut.after}
        </p>
      )}
      {session ? <PasskeyOffer /> : null}
      {/* Also in the menu, on purpose: here a first visit sees it, the menu
          keeps it reachable from every other screen. */}
      <InstallButton className={secondaryButtonClass} />
    </main>
  );
}
