import { useEffect, useSyncExternalStore } from "react";

import { useI18n } from "../i18n/i18n-context";
import { BusyLabel } from "./spinner";
import { BUTTON_EMOJI } from "./ui";

/** What the snackbar says, and what its Retry button does, if it has one. */
export type SnackbarMessage = { text: string; retry?: () => void };

/** How long a message stays before it goes by itself. */
const SHOW_MS = 6000;

type Shown = SnackbarMessage & { id: number };

let current: Shown | null = null;
let nextId = 1;
const listeners = new Set<() => void>();

function publish(next: Shown | null): void {
  current = next;
  for (const listener of listeners) {
    listener();
  }
}

/**
 * Shows a short message at the bottom of the screen, e.g. that a change
 * shown at once could not be saved and was undone. A newer message replaces
 * the one on screen.
 */
export function showSnackbar(message: SnackbarMessage): void {
  publish({ ...message, id: nextId++ });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The one snackbar of the app, rendered once in the root layout. */
export function Snackbar() {
  const { t } = useI18n();
  const shown = useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  );

  useEffect(() => {
    if (!shown) {
      return;
    }
    const timer = setTimeout(() => {
      if (current?.id === shown.id) {
        publish(null);
      }
    }, SHOW_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [shown]);

  if (!shown) {
    return null;
  }
  const { retry } = shown;
  return (
    <output
      data-testid="snackbar"
      className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-md items-center gap-3 rounded-xl bg-neutral-900 py-2 pr-2 pl-4 text-sm text-white shadow-lg dark:bg-neutral-100 dark:text-neutral-900"
    >
      <span className="min-w-0 flex-1">{shown.text}</span>
      {retry ? (
        <button
          type="button"
          onClick={() => {
            publish(null);
            retry();
          }}
          className="min-h-11 shrink-0 rounded-lg px-3 font-medium text-blue-300 hover:bg-white/10 dark:text-blue-700 dark:hover:bg-black/10"
        >
          <BusyLabel emoji={BUTTON_EMOJI.retry}>{t.common.retry}</BusyLabel>
        </button>
      ) : null}
      <button
        type="button"
        aria-label={t.common.dismiss}
        onClick={() => {
          publish(null);
        }}
        className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg hover:bg-white/10 dark:hover:bg-black/10"
      >
        ✕
      </button>
    </output>
  );
}
