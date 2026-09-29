import { type ReactNode, useEffect } from "react";

/**
 * A menu that slides in from the left edge over a dimmed page. Stays mounted
 * so the slide animates both ways; while closed it is inert and hidden from
 * assistive tech. Closes on the backdrop, the ✕ button or Escape.
 */
export function Drawer({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  return (
    <div
      className={`fixed inset-0 z-50 ${open ? "" : "pointer-events-none"}`}
      aria-hidden={!open}
      inert={!open}
    >
      <button
        type="button"
        aria-label="Close menu"
        onClick={onClose}
        className={`absolute inset-0 bg-black/40 transition-opacity duration-200 ${open ? "opacity-100" : "opacity-0"}`}
      />
      <nav
        aria-label={title}
        className={`absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-white shadow-xl transition-transform duration-200 ease-out dark:bg-neutral-900 ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex min-h-14 items-center justify-between border-b border-neutral-200 px-4 dark:border-neutral-800">
          <span className="font-semibold">{title}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="min-h-11 min-w-11 rounded-lg text-lg hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            ✕
          </button>
        </div>
        <div className="flex flex-1 flex-col overflow-y-auto">{children}</div>
      </nav>
    </div>
  );
}
