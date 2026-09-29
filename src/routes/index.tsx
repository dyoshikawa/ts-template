import { createFileRoute, Link } from "@tanstack/react-router";

import { InstallButton } from "../components/install-button";
import { Logo } from "../components/logo";
import { secondaryButtonClass } from "../components/ui";
import { APP_NAME } from "../lib/app";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const { session } = Route.useRouteContext();

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-4 sm:p-6">
      <div className="flex items-center gap-4">
        <Logo size={48} />
        <h1 className="text-2xl font-bold sm:text-3xl">{APP_NAME}</h1>
      </div>
      {session ? (
        <p className="text-neutral-600 dark:text-neutral-400">
          Signed in as <span className="font-medium">{session.user.email}</span>. Turn on push
          notifications from your{" "}
          <Link to="/account" className="underline">
            account
          </Link>
          .
        </p>
      ) : (
        <p className="text-neutral-600 dark:text-neutral-400">
          <Link to="/login" className="underline">
            Sign in
          </Link>{" "}
          with your email address to get started. No password needed.
        </p>
      )}
      <InstallButton className={secondaryButtonClass} />
    </main>
  );
}
