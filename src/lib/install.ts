/**
 * Installing the app — the PWA the manifest makes of it. Chrome, Edge and Samsung Internet on Android (and
 * Chrome and Edge on a desktop) announce an install they are ready to
 * offer with a `beforeinstallprompt` event, held here until a tap on the
 * install button fires it. iOS has no such API at all: Safari — and since
 * iOS 16.4 every browser there — installs from the share sheet's "Add to
 * Home Screen" alone, so the button opens the way there instead.
 */

/** Chrome's event, which lib.dom does not know: the offer, and the answer once it was shown. */
type InstallPromptEvent = Event & {
  readonly prompt: () => Promise<void>;
  readonly userChoice: Promise<{ readonly outcome: "accepted" | "dismissed" }>;
};

type InstallState = {
  /** The browser's offer, held until a tap fires it; null before one comes, and once it was used. */
  readonly offer: InstallPromptEvent | null;
  /** Whether the app runs installed already, or was installed just now. */
  readonly installed: boolean;
};

/**
 * What the install button does: fire the browser's own offer, show the
 * way through the share sheet (iOS) or the browser's menu (a phone whose
 * browser made no offer — Firefox, an app's own browser), or stay away —
 * installed already, or a desktop browser that offers nothing.
 */
export type InstallAction = "prompt" | "guide-ios" | "guide-browser" | null;

export const installAction = ({
  installed,
  offer,
  ios,
  touch,
}: {
  installed: boolean;
  offer: boolean;
  ios: boolean;
  touch: boolean;
}): InstallAction => {
  if (installed) {
    return null;
  }
  if (offer) {
    return "prompt";
  }
  if (ios) {
    return "guide-ios";
  }
  return touch ? "guide-browser" : null;
};

type Listener = () => void;

let state: InstallState = { offer: null, installed: false };
const listeners = new Set<Listener>();

const set = (next: InstallState): void => {
  state = next;
  for (const listener of listeners) {
    listener();
  }
};

/** The offer and the standing, for the React side (`useSyncExternalStore`); the page server sees neither. */
export const installStore = {
  subscribe: (listener: Listener): (() => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  get: (): InstallState => state,
};

/** Whether the page opened as the installed app (the manifest's `standalone`) or from iOS's home screen. */
const runsInstalled = (): boolean =>
  window.matchMedia("(display-mode: standalone), (display-mode: fullscreen)").matches ||
  (navigator as { standalone?: boolean }).standalone === true;

/** Whether this is an iPhone or an iPad — the iPad calls itself a Mac with fingers since iPadOS 13. */
const isIos = (): boolean =>
  typeof navigator !== "undefined" &&
  (/iPad|iPhone|iPod/u.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

let listening = false;

/**
 * Starts listening for the browser's offer. Called as the root's module
 * loads rather than from an effect: the browser makes its offer once the
 * page has loaded, which a route loaded later, or an effect run after
 * hydration, could come too late for. Nothing on the page server.
 */
export const listenForInstallOffers = (): void => {
  if (typeof window === "undefined" || listening) {
    return;
  }
  listening = true;
  state = { offer: null, installed: runsInstalled() };
  window.addEventListener("beforeinstallprompt", (event) => {
    // Held for the button; the browser's own bar stays away.
    event.preventDefault();
    set({ ...state, offer: event as InstallPromptEvent });
  });
  window.addEventListener("appinstalled", () => {
    set({ offer: null, installed: true });
  });
};

/**
 * Fires the held offer — the browser's own install dialog — and reports
 * how it went. An offer fires once: dismissed, it is gone until the browser
 * makes another, which Chrome takes its time over.
 */
export const promptInstall = async (): Promise<"accepted" | "dismissed" | "none"> => {
  const { offer } = state;
  if (offer === null) {
    return "none";
  }
  set({ ...state, offer: null });
  try {
    await offer.prompt();
    const { outcome } = await offer.userChoice;
    if (outcome === "accepted") {
      set({ offer: null, installed: true });
    }
    return outcome;
  } catch {
    // The browser refused to show it — a prompt fired twice, or outside a tap.
    return "dismissed";
  }
};

/** Whether the device is driven by fingers first: a phone or a tablet. */
const isTouchFirst = (): boolean => window.matchMedia("(pointer: coarse)").matches;

/** What the install button does now, from the browser's offer and what device this is. */
export const installActionNow = (): InstallAction =>
  installAction({
    installed: state.installed,
    offer: state.offer !== null,
    ios: isIos(),
    touch: isTouchFirst(),
  });
