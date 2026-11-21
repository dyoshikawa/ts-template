// The arithmetic and the checks behind pull-down-to-reload in the installed
// app (`src/components/pull-to-reload.tsx`), apart from the component so they
// can be tested without a browser.

/** How far (px) the finger must pull down before a release reloads. */
export const PULL_THRESHOLD = 80;

/** The badge moves this much slower than the finger, so the pull feels resisted. */
const RESISTANCE = 0.75;

/** The farthest (px) the badge follows the finger. */
const MAX_TRAVEL = 112;

/** How far (deg) the reload icon turns by the time the pull reaches the threshold. */
const WIND_UP = 270;

/** How far (px) the finger has pulled for a move of `dy` px from where it started (up cancels). */
export function pullDistance(dy: number): number {
  return Math.max(0, dy);
}

/**
 * How far (px) below the top safe area a finger may be put down to start a
 * pull: the header and a little under it. A downward swipe that starts lower
 * on the page never reloads, even with the page at the top (owner's decision
 * 2026-11-05: a pull from anywhere reloaded too easily).
 */
const PULL_BAND = 96;

/** Whether a finger put down at `y` (px from the top edge) may start a pull, below a `safeTop` px notch. */
export function startsInPullBand({ y, safeTop }: { y: number; safeTop: number }): boolean {
  return y <= safeTop + PULL_BAND;
}

/** Whether releasing at this pull reloads the page. */
export function releaseReloads(pull: number): boolean {
  return pull >= PULL_THRESHOLD;
}

/** How the indicator looks at a pull: all transform and opacity, nothing that changes layout. */
export type PullFrame = {
  /** px the badge has slid down from its hiding place above the top edge. */
  travel: number;
  /** deg the reload icon has turned. */
  rotate: number;
  scale: number;
  opacity: number;
  /** Past the threshold: the accent color and the release label. */
  ready: boolean;
};

/**
 * The indicator for a finger `pull` px down: the badge follows with
 * resistance, and the icon winds up — turning in proportion to the pull while
 * it scales from 0.6 and fades in — until the threshold makes it ready. With
 * reduced motion it neither turns nor scales.
 */
export function pullFrame({
  pull,
  reducedMotion,
}: {
  pull: number;
  reducedMotion: boolean;
}): PullFrame {
  const progress = Math.min(1, pull / PULL_THRESHOLD);
  return {
    travel: Math.min(MAX_TRAVEL, pull * RESISTANCE),
    rotate: reducedMotion ? 0 : (pull / PULL_THRESHOLD) * WIND_UP,
    scale: reducedMotion ? 1 : 0.6 + 0.4 * progress,
    opacity: progress,
    ready: releaseReloads(pull),
  };
}

/** Display modes in which the app runs installed, without the browser's own pull-to-refresh. */
const STANDALONE_QUERIES = [
  "(display-mode: standalone)",
  "(display-mode: fullscreen)",
  "(display-mode: minimal-ui)",
];

/** Whether the app runs as an installed PWA (iOS reports it through `navigator.standalone`). */
export function isStandalone({
  matchMedia,
  navigatorStandalone,
}: {
  matchMedia: (query: string) => { matches: boolean };
  navigatorStandalone: boolean | undefined;
}): boolean {
  return (
    navigatorStandalone === true || STANDALONE_QUERIES.some((query) => matchMedia(query).matches)
  );
}

/**
 * Where a pull may not start: popups, the open menu, form fields, editable
 * text, canvases and anything else marked `data-no-pull` (its own drag or
 * scroll).
 */
const NO_PULL_SELECTOR =
  "dialog, [role=dialog], [aria-modal=true], [data-no-pull], canvas, input, textarea, select, [contenteditable]:not([contenteditable=false])";

/**
 * Whether a pull may not start at `target`: it sits in a popup, the menu or a
 * form field (`NO_PULL_SELECTOR`), in something scrolled down, which the
 * finger scrolls back first, or in something that takes the finger itself
 * with `touch-action: none` (an area picker, an order handle, a resize grip),
 * so a drag down on it is never taken for a pull.
 */
export function pullBlockedAt(target: Element): boolean {
  if (target.closest(NO_PULL_SELECTOR)) {
    return true;
  }
  for (let element: Element | null = target; element; element = element.parentElement) {
    if (element.scrollTop > 0 || getComputedStyle(element).touchAction === "none") {
      return true;
    }
  }
  return false;
}
