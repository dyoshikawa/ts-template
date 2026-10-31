function cancel(event: Event): void {
  event.preventDefault();
}

function cancelMultiTouch(event: TouchEvent): void {
  if (event.touches.length > 1) {
    event.preventDefault();
  }
}

/**
 * Keeps the page from being pinch-zoomed. The viewport meta asks for that,
 * but iOS Safari ignores `user-scalable=no`, so its gesture events and any
 * two-finger move are cancelled too. Returns the undo.
 */
export function guardAgainstPageZoom(): () => void {
  // `passive: false`: a passive listener could not cancel the zoom.
  const options = { passive: false } as const;
  document.addEventListener("gesturestart", cancel, options);
  document.addEventListener("gesturechange", cancel, options);
  document.addEventListener("touchmove", cancelMultiTouch, options);
  return () => {
    document.removeEventListener("gesturestart", cancel);
    document.removeEventListener("gesturechange", cancel);
    document.removeEventListener("touchmove", cancelMultiTouch);
  };
}
