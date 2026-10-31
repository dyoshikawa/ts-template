import { type ReactNode, type TouchEvent, useEffect, useRef } from "react";

/** How far a swipe back toward the left edge must go to close the menu. */
const SWIPE_CLOSE_PX = 80;

/**
 * Lets a finger drag the menu back toward the left edge: it follows the
 * finger sideways (transform only) and closes past `SWIPE_CLOSE_PX`, or
 * slides back open. A mostly vertical drag is left to the list's scroll.
 */
function useSwipeToClose(onClose: () => void) {
  const panel = useRef<HTMLElement>(null);
  const swipe = useRef<{ x: number; y: number; dx: number; sideways: boolean | null } | null>(null);

  const follow = (dx: number | null) => {
    const element = panel.current;
    if (!element) {
      return;
    }
    element.style.transition = dx === null ? "" : "none";
    element.style.translate = dx === null ? "" : `${dx}px 0`;
  };

  const handlers = {
    onTouchStart: (event: TouchEvent) => {
      const touch = event.touches[0];
      swipe.current =
        event.touches.length === 1 && touch
          ? { x: touch.clientX, y: touch.clientY, dx: 0, sideways: null }
          : null;
    },
    onTouchMove: (event: TouchEvent) => {
      const touch = event.touches[0];
      const current = swipe.current;
      if (!current || !touch) {
        return;
      }
      const dx = touch.clientX - current.x;
      const dy = touch.clientY - current.y;
      if (current.sideways === null && Math.hypot(dx, dy) > 10) {
        current.sideways = Math.abs(dx) > Math.abs(dy);
      }
      if (current.sideways) {
        current.dx = Math.min(0, dx);
        follow(current.dx);
      }
    },
    onTouchCancel: () => {
      swipe.current = null;
      follow(null);
    },
    onTouchEnd: () => {
      const current = swipe.current;
      swipe.current = null;
      follow(null);
      if (current?.sideways && current.dx <= -SWIPE_CLOSE_PX) {
        onClose();
      }
    },
  };
  return [panel, handlers] as const;
}

/**
 * A menu that slides in from the left edge. On a phone it fills the whole
 * screen (no sliver of page beside it); from tablet width up it is a panel
 * over a dimmed page. Stays mounted so the slide animates both ways; while
 * closed it is inert and hidden from assistive tech. Closes on the ✕ button
 * in its header, Escape, a swipe back toward the left edge, or the backdrop.
 */
export function Drawer({
  open,
  title,
  closeLabel,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  /** The accessible name of the ✕ button and the backdrop. */
  closeLabel: string;
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
  const [panel, swipe] = useSwipeToClose(onClose);

  return (
    <div
      className={`fixed inset-0 z-50 ${open ? "" : "pointer-events-none"}`}
      aria-hidden={!open}
      inert={!open}
    >
      <button
        type="button"
        aria-label={closeLabel}
        onClick={onClose}
        className={`absolute inset-0 bg-black/40 transition-opacity duration-200 ${open ? "opacity-100" : "opacity-0"}`}
      />
      <nav
        aria-label={title}
        ref={panel}
        {...swipe}
        // Hidden while closed (with visibility in the transition, so the slide
        // out still plays): parked off screen, its shadow would otherwise
        // still shade the left edge.
        className={`absolute inset-y-0 left-0 flex w-full touch-pan-y flex-col bg-white transition-[translate,transform,visibility] duration-200 ease-out sm:w-80 sm:max-w-[85vw] dark:bg-neutral-900 ${open ? "translate-x-0 sm:shadow-xl" : "invisible -translate-x-full"}`}
      >
        <div className="flex min-h-14 shrink-0 items-center justify-between border-b border-neutral-200 px-4 pt-[env(safe-area-inset-top)] dark:border-neutral-800">
          <span className="font-semibold">{title}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="min-h-11 min-w-11 rounded-lg text-lg hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            ✕
          </button>
        </div>
        <div className="flex flex-1 flex-col overflow-y-auto pb-[env(safe-area-inset-bottom)]">
          {children}
        </div>
      </nav>
    </div>
  );
}
