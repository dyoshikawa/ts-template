import { useState, useSyncExternalStore } from "react";

import { useI18n } from "../i18n/i18n-context";
import { type InstallAction, installActionNow, installStore, promptInstall } from "../lib/install";
import { Sheet } from "./sheet";
import { BusyLabel } from "./spinner";
import { BUTTON_EMOJI } from "./ui";

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
  const { t } = useI18n();
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
        <BusyLabel emoji={BUTTON_EMOJI.install}>
          {action === "guide-ios" ? t.install.addToHomeScreen : t.install.installApp}
        </BusyLabel>
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

/** The way to install by hand, in a sheet: Escape, the backdrop and its ✕ close it. */
function InstallGuide({ way, onClose }: { way: InstallWay; onClose: () => void }) {
  const { t } = useI18n();
  const guide = t.install[way];
  return (
    <Sheet title={guide.title} closeLabel={t.common.close} onClose={onClose}>
      <ol className="mb-3 list-decimal space-y-2 pl-5 text-sm">
        {guide.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      {way === "ios" ? (
        <p className="text-xs text-neutral-600 dark:text-neutral-400">{t.install.ios.note}</p>
      ) : null}
    </Sheet>
  );
}
