import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { type ReactNode, useEffect } from "react";

import { Header } from "../components/header";
import { NavigationProgress } from "../components/navigation-progress";
import { PullToReload } from "../components/pull-to-reload";
import { Snackbar } from "../components/snackbar";
import { I18nProvider, useI18n } from "../i18n/i18n-context";
import { APP_NAME } from "../lib/app";
import { getRootContext } from "../lib/auth-functions";
import { listenForInstallOffers } from "../lib/install";
import { guardAgainstPageZoom } from "../lib/zoom-guard";

import appCss from "../styles.css?url";

// The browser's offer to install the app is made once the page has loaded;
// it is listened for as this module loads, ahead of any route or effect.
listenForInstallOffers();

export const Route = createRootRoute({
  // Resolved once per navigation and exposed to every route as
  // `context.session` and `context.language`.
  beforeLoad: () => getRootContext(),
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        // No pinch zoom anywhere; iOS ignores this, hence guardAgainstPageZoom too.
        name: "viewport",
        content:
          "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover",
      },
      { title: APP_NAME },
      { name: "color-scheme", content: "light dark" },
      { name: "application-name", content: APP_NAME },
      { name: "apple-mobile-web-app-title", content: APP_NAME },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", href: "/icons/icon-192.png", type: "image/png" },
      { rel: "apple-touch-icon", href: "/icons/apple-touch-icon.png" },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  const { session, language } = Route.useRouteContext();
  useServiceWorker();
  useEffect(guardAgainstPageZoom, []);

  return (
    <I18nProvider language={language}>
      <RootDocument>
        <NavigationProgress />
        <PullToReload />
        <Header session={session} />
        <Outlet />
        <Snackbar />
      </RootDocument>
    </I18nProvider>
  );
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  // Follows a switch at once, before the server has saved it.
  const { language } = useI18n();
  return (
    <html lang={language}>
      <head>
        <HeadContent />
        {/* Written here rather than in `head()`: HeadContent keeps one meta per
            name, so the per-scheme pair would collapse into one. */}
        <meta name="theme-color" content="#2563eb" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#1e3a8a" media="(prefers-color-scheme: dark)" />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

/**
 * Registers `public/sw.js` in production builds only; in `vite dev` a service
 * worker would fight HMR and cache stale modules.
 */
function useServiceWorker() {
  useEffect(() => {
    if (!import.meta.env.PROD || !("serviceWorker" in navigator)) {
      return;
    }
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Registration failing (e.g. a private window) must not break the app.
    });
  }, []);
}
