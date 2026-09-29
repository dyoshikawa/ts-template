import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { type InstallAction, installActionNow, installStore, promptInstall } from "../lib/install";
import { secondaryButtonClass } from "./ui";

type InstallWay = "ios" | "browser";

/** What the install button does now; nothing for the page server, so the page hydrates as rendered. */
function useInstallAction(): InstallAction {
  return useSyncExternalStore(installStore.subscribe, installActionNow, () => null);
}

/**
 * The way to install the app, on the top page and in the menu. Where the
 * browser has offered one (Chrome, Edge, Samsung Internet), a tap fires its
 * own install dialog; on iOS, and on a phone whose browser offered nothing,
 * it opens the guide to doing it by hand. Nothing once the app runs
 * installed, and nothing on a desktop browser that offers nothing.
 */
export function InstallButton({ className }: { className: string }) {
  const action = useInstallAction();
  const [guide, setGuide] = useState<InstallWay | null>(null);
  if (action === null) {
    return null;
  }
  return (
    <>
      <button
        type="button"
        className={className}
        onClick={() => {
          if (action === "prompt") {
            void promptInstall();
          } else {
            setGuide(action === "guide-ios" ? "ios" : "browser");
          }
        }}
      >
        📲 {action === "guide-ios" ? "Add to Home Screen" : "Install app"}
      </button>
      {guide === null ? null : (
        <InstallGuide
          way={guide}
          onClose={() => {
            setGuide(null);
          }}
        />
      )}
    </>
  );
}

const GUIDES: Record<InstallWay, { title: string; steps: readonly string[] }> = {
  ios: {
    title: "How to add to your Home Screen",
    steps: [
      "In Safari, tap the Share button at the bottom of the screen (top right on iPad).",
      "Scroll down the sheet and tap “Add to Home Screen”.",
      "Tap “Add” at the top right. The app's icon appears on your Home Screen.",
    ],
  },
  browser: {
    title: "How to install the app",
    steps: [
      "Open the browser's menu (⋮) at the top right.",
      "Tap “Install app” or “Add to Home Screen” and confirm.",
    ],
  },
};

/** The way to install by hand, as a native dialog: Escape and its button close it. */
function InstallGuide({ way, onClose }: { way: InstallWay; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (element !== null && !element.open) {
      element.showModal();
    }
  }, []);
  const guide = GUIDES[way];
  return (
    <dialog
      ref={dialog}
      aria-labelledby="install-guide-title"
      onClose={onClose}
      className="m-auto max-w-md rounded-2xl bg-white p-5 text-neutral-900 shadow-xl backdrop:bg-black/50 dark:bg-neutral-900 dark:text-neutral-100"
    >
      <h2 id="install-guide-title" className="mb-3 text-lg font-bold">
        {guide.title}
      </h2>
      <ol className="mb-3 list-decimal space-y-2 pl-5 text-sm">
        {guide.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      {way === "ios" ? (
        <p className="mb-3 text-xs text-neutral-600 dark:text-neutral-400">
          The Home Screen app does not share Safari&apos;s sign-in, so sign in once more the first
          time you open it.
        </p>
      ) : null}
      <button
        type="button"
        className={`${secondaryButtonClass} w-full`}
        onClick={() => dialog.current?.close()}
      >
        Close
      </button>
    </dialog>
  );
}
