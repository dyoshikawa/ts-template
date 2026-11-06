import {
  createRootRoute,
  type ErrorComponentProps,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import { type ReactNode, useEffect, useRef, useSyncExternalStore } from "react";

import { Header } from "../components/header";
import { NavigationProgress } from "../components/navigation-progress";
import { PullToReload } from "../components/pull-to-reload";
import { RouteError } from "../components/route-error";
import { Snackbar } from "../components/snackbar";
import { I18nProvider, useI18n } from "../i18n/i18n-context";
import { type Language } from "../i18n/language";
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
  // The root's own failure (its session read runs on every navigation, so
  // any navigation while offline) would otherwise put the bare error page in
  // place of the whole document, losing the viewport meta (pinch zoom comes
  // back), the styles' theme colors and `<html lang>`.
  errorComponent: RootError,
});

function RootComponent() {
  const { session, language } = Route.useRouteContext();
  useServiceWorker();

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

/**
 * The language of a page whose root context failed to load, in the browser:
 * the one the app was last shown in, or, when the server could not render
 * the app at all (its document is the error shell), the browser's own.
 */
function browserFallbackLanguage(): Language {
  const html = document.documentElement;
  if (html.dataset.shell === "error") {
    return navigator.languages.some((tag) => /^ja\b/iu.test(tag)) ? "ja" : "en";
  }
  return html.lang === "en" ? "en" : "ja";
}

/** Never changes while the page is open; there is nothing to subscribe to. */
function subscribeNever(): () => void {
  return () => {};
}

/**
 * {@link browserFallbackLanguage}, read once per error page: the server
 * render (which has no request language without the root context) and
 * hydration use the default, then the browser's answer.
 */
function useFallbackLanguage(): Language {
  const chosen = useRef<Language | null>(null);
  return useSyncExternalStore(
    subscribeNever,
    () => (chosen.current ??= browserFallbackLanguage()),
    () => "ja",
  );
}

function RootError(props: ErrorComponentProps) {
  const language = useFallbackLanguage();
  return (
    <I18nProvider language={language}>
      <RootDocument shell="error">
        <RouteError {...props} />
      </RootDocument>
    </I18nProvider>
  );
}

function RootDocument({
  shell = "app",
  children,
}: Readonly<{ shell?: "app" | "error"; children: ReactNode }>) {
  // Follows a switch at once, before the server has saved it.
  const { language } = useI18n();
  // In the document shell, so the error page keeps it too.
  useEffect(guardAgainstPageZoom, []);
  return (
    <html lang={language} data-shell={shell}>
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
 * Registers `public/sw.js` in production builds only; in `vp dev` a service
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
