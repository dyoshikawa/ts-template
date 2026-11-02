import { type ReactNode, useEffect, useRef } from "react";

/**
 * A popup that fills the screen on phones (a centred dialog on wider
 * screens), as a native modal dialog: Escape, the close button and (in
 * browsers with `closedby`) the backdrop dismiss it. The title bar stays put
 * while the body scrolls, clear of the notch and the home indicator.
 */
export function Sheet({
  title,
  closeLabel,
  onClose,
  children,
}: {
  title: string;
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) {
      element.showModal();
    }
  }, []);
  return (
    <dialog
      ref={dialog}
      aria-label={title}
      onClose={onClose}
      // A tap on the backdrop closes it too, where the browser supports it.
      {...{ closedby: "any" }}
      className="m-0 h-dvh max-h-none w-full max-w-full bg-white p-0 text-neutral-900 shadow-xl backdrop:bg-black/50 sm:m-auto sm:h-fit sm:max-h-[85dvh] sm:max-w-lg sm:rounded-2xl dark:bg-neutral-900 dark:text-neutral-100"
    >
      <div className="flex h-full flex-col pt-[env(safe-area-inset-top)] sm:max-h-[85dvh] sm:pt-0">
        <div className="flex min-h-12 shrink-0 items-center justify-between border-b border-neutral-200 px-4 dark:border-neutral-800">
          <h2 className="font-semibold">{title}</h2>
          <button
            type="button"
            aria-label={closeLabel}
            onClick={() => dialog.current?.close()}
            className="min-h-11 min-w-11 rounded-lg text-lg hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            ✕
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {children}
        </div>
      </div>
    </dialog>
  );
}
