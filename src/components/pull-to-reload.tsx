import { useEffect, useRef, useSyncExternalStore } from "react";

import { useI18n } from "../i18n/i18n-context";
import {
  isStandalone,
  NO_PULL_SELECTOR,
  pullDistance,
  pullFrame,
  releaseReloads,
} from "../lib/pull-to-reload";

/** How long (ms) a cancelled pull takes to spring back out of view (matches styles.css). */
const SPRING_BACK_MS = 200;

/** Where the badge hides (px): its own height above the top edge, plus room for its shadow. */
const HIDDEN_OFFSET = -48;

/**
 * Pull down to reload, for the installed app only: a browser tab has its
 * own pull-to-refresh, which standalone mode loses (iOS has none there). A
 * one-finger pull that starts with the page at the very top, outside popups,
 * the open menu and scrolled inner lists, slides a round reload badge down
 * after the finger, winding its icon up; past the threshold it turns ready
 * (accent color, a pop, "Release to reload"), and a release there keeps it
 * spinning while the page reloads. A shorter pull springs it back out of
 * view. The badge is moved with transform and opacity only, once per
 * animation frame, and the look per state lives in styles.css. No screen
 * of the template holds unsaved input; one that does must ask before the
 * reload drops it.
 */
export function PullToReload() {
  const { t } = useI18n();
  // False on the server and in a browser tab; the display mode never changes while the page lives.
  const enabled = useSyncExternalStore(subscribeToNothing, runsInstalled, () => false);
  const root = useRef<HTMLOutputElement>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    // Keeps the browser's own overscroll bounce from fighting this pull.
    const documentElement = document.documentElement;
    const previous = documentElement.style.overscrollBehaviorY;
    documentElement.style.overscrollBehaviorY = "contain";

    let start: { y: number; id: number } | null = null;
    let current = 0;
    let reducedMotion = false;
    let frame = 0;
    let springBack = 0;
    // Whether this gesture has drawn the badge, which a cancel must then put away.
    let shown = false;

    const parts = () => {
      const element = root.current;
      return element
        ? {
            element,
            badge: element.querySelector<HTMLElement>("[data-pull-badge]"),
            icon: element.querySelector<HTMLElement>("[data-pull-icon]"),
            label: element.querySelector<HTMLElement>("[data-pull-label]"),
          }
        : null;
    };
    const paint = () => {
      frame = 0;
      const found = parts();
      if (!found || !start) {
        return;
      }
      const { element, badge, icon, label } = found;
      const look = pullFrame({ pull: current, reducedMotion });
      shown = true;
      element.dataset.state = look.ready ? "ready" : "pulling";
      element.style.transition = "none";
      element.style.transform = `translate3d(0, ${HIDDEN_OFFSET + look.travel}px, 0)`;
      if (badge) {
        badge.style.transform = `scale(${look.scale})`;
        badge.style.opacity = String(look.opacity);
      }
      if (icon) {
        icon.style.transform = `rotate(${look.rotate}deg)`;
      }
      if (label) {
        label.textContent = (look.ready ? label.dataset.ready : label.dataset.pulling) ?? "";
      }
    };
    const hide = () => {
      shown = false;
      const found = parts();
      if (!found) {
        return;
      }
      const { element, badge } = found;
      element.dataset.state = reducedMotion ? "idle" : "returning";
      // Its shadow reaches past the hiding place, so it fades out on the way back up.
      if (badge) {
        badge.style.opacity = "0";
      }
      element.style.transition = "";
      element.style.transform = `translate3d(0, ${HIDDEN_OFFSET}px, 0)`;
      window.clearTimeout(springBack);
      springBack = window.setTimeout(
        () => {
          if (element.dataset.state === "returning") {
            element.dataset.state = "idle";
          }
        },
        reducedMotion ? 0 : SPRING_BACK_MS,
      );
    };
    const reload = () => {
      const found = parts();
      if (found) {
        found.element.dataset.state = "reloading";
        // The spin animation takes the icon over from the wind-up angle.
        if (found.icon) {
          found.icon.style.transform = "";
        }
        if (found.label) {
          found.label.textContent = found.label.dataset.reloading ?? "";
        }
      }
      location.reload();
    };

    const onStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (root.current?.dataset.state === "reloading") {
        return;
      }
      start =
        event.touches.length === 1 && touch && canStartAt(event.target) && window.scrollY <= 0
          ? { y: touch.clientY, id: touch.identifier }
          : null;
      current = 0;
      reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    };
    const onMove = (event: TouchEvent) => {
      if (!start) {
        return;
      }
      const touch = [...event.touches].find((candidate) => candidate.identifier === start?.id);
      if (event.touches.length !== 1 || !touch) {
        start = null;
        current = 0;
        if (shown) {
          hide();
        }
        return;
      }
      current = pullDistance(touch.clientY - start.y);
      if (!frame) {
        frame = requestAnimationFrame(paint);
      }
    };
    const onEnd = () => {
      if (!start) {
        return;
      }
      cancelAnimationFrame(frame);
      frame = 0;
      if (releaseReloads(current)) {
        paint();
        reload();
      } else if (shown) {
        hide();
      }
      start = null;
      current = 0;
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", onEnd);
    return () => {
      documentElement.style.overscrollBehaviorY = previous;
      cancelAnimationFrame(frame);
      window.clearTimeout(springBack);
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, [enabled]);

  // Only ever rendered in the installed app: a browser tab gets nothing.
  if (!enabled) {
    return null;
  }
  return (
    <output
      ref={root}
      data-pull-to-reload=""
      data-state="idle"
      className="pull-to-reload"
      style={{ transform: `translate3d(0, ${HIDDEN_OFFSET}px, 0)` }}
    >
      <span data-pull-badge="" className="pull-to-reload-badge">
        <span className="pull-to-reload-pop">
          <svg
            data-pull-icon=""
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="pull-to-reload-icon"
          >
            <path d="M20 12a8 8 0 1 1-2.34-5.66" />
            <path d="M20 4v5h-5" />
          </svg>
        </span>
      </span>
      {/* The effect swaps the text as the pull goes on, in the language of the page. */}
      <span
        data-pull-label=""
        data-pulling={t.common.pullToReload}
        data-ready={t.common.releaseToReload}
        data-reloading={t.common.reloading}
        className="pull-to-reload-label"
      >
        {t.common.pullToReload}
      </span>
    </output>
  );
}

function subscribeToNothing(): () => void {
  return () => {};
}

function runsInstalled(): boolean {
  return isStandalone({
    matchMedia: (query) => window.matchMedia(query),
    navigatorStandalone: (navigator as { standalone?: boolean }).standalone,
  });
}

/** A pull may start only on the page itself, not inside anything with its own scroll or drag. */
function canStartAt(target: EventTarget | null): boolean {
  if (!(target instanceof Element) || target.closest(NO_PULL_SELECTOR)) {
    return false;
  }
  for (let element: Element | null = target; element; element = element.parentElement) {
    if (element.scrollTop > 0) {
      return false;
    }
  }
  return true;
}
