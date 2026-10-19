import { useEffect, useRef } from "react";

import type { TurnstileClientConfig } from "../lib/turnstile";

const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
      theme: "auto";
      size: "flexible";
    },
  ) => string;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

/** Resolves once Cloudflare's Turnstile script is on the page (loaded at most once). */
function loadTurnstile(): Promise<TurnstileApi> {
  return new Promise((resolve, reject) => {
    if (window.turnstile) {
      resolve(window.turnstile);
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_URL}"]`);
    const script = existing ?? document.createElement("script");
    script.addEventListener("load", () => {
      if (window.turnstile) {
        resolve(window.turnstile);
      } else {
        reject(new Error("Turnstile did not initialize"));
      }
    });
    script.addEventListener("error", () => {
      reject(new Error("Turnstile failed to load"));
    });
    if (!existing) {
      script.src = SCRIPT_URL;
      script.async = true;
      document.head.appendChild(script);
    }
  });
}

/** The token handed out when Turnstile is switched off; the server accepts anything then. */
const DISABLED_TOKEN = "turnstile-disabled";

/**
 * A Cloudflare Turnstile widget. `onToken` receives a token once the
 * challenge passes and `null` when it expires or fails, so the caller can
 * enable and disable the action it guards. While Turnstile is disabled on the
 * server (a local run) nothing is rendered and a placeholder token is handed
 * out at once; on a server without a key pair no token is ever handed out and
 * a notice says the action is unavailable.
 */
export function Turnstile({
  config,
  onToken,
}: {
  config: TurnstileClientConfig;
  onToken: (token: string | null) => void;
}) {
  const siteKey = config.status === "enabled" ? config.siteKey : "";
  const { status } = config;
  const container = useRef<HTMLDivElement>(null);
  const latestOnToken = useRef(onToken);

  useEffect(() => {
    latestOnToken.current = onToken;
  }, [onToken]);

  useEffect(() => {
    if (status === "disabled") {
      latestOnToken.current(DISABLED_TOKEN);
      return;
    }
    if (status === "unconfigured") {
      latestOnToken.current(null);
      return;
    }
    let widgetId: string | null = null;
    let cancelled = false;
    loadTurnstile()
      .then((turnstile) => {
        if (cancelled || !container.current) {
          return;
        }
        widgetId = turnstile.render(container.current, {
          sitekey: siteKey,
          callback: (token) => {
            latestOnToken.current(token);
          },
          "expired-callback": () => {
            latestOnToken.current(null);
          },
          "error-callback": () => {
            latestOnToken.current(null);
          },
          theme: "auto",
          size: "flexible",
        });
      })
      .catch(() => {
        latestOnToken.current(null);
      });
    return () => {
      cancelled = true;
      if (widgetId !== null) {
        window.turnstile?.remove(widgetId);
      }
    };
  }, [status, siteKey]);

  if (status === "disabled") {
    return null;
  }
  if (status === "unconfigured") {
    return (
      <p role="alert" className="text-sm text-red-600 dark:text-red-400">
        This action is unavailable: the verification check is not set up on this server.
      </p>
    );
  }
  return <div ref={container} className="min-h-16" />;
}
