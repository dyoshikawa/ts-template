import { type ReactNode } from "react";

/**
 * A small spinning ring in the current text color: the sign that the
 * control next to it is waiting for the server. Never covers the screen.
 */
export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      data-spinner=""
      className={`inline-block size-4 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent ${className}`}
    />
  );
}

/**
 * The emoji in front of a button's label: decoration
 * only, hidden from screen readers so the accessible name is the label.
 */
export function Emoji({ children }: { children: string }) {
  return <span aria-hidden="true">{children}</span>;
}

/**
 * A button's label with its emoji in front, which turns into a spinner
 * while `busy`; the label itself (and so the button's accessible name) is
 * whatever the caller passes.
 */
export function BusyLabel({
  busy = false,
  emoji,
  children,
}: {
  busy?: boolean;
  emoji?: string;
  children: ReactNode;
}) {
  // A link-styled button's underline does not reach into an inline-flex box
  // on its own; inheriting it keeps such buttons looking like links.
  return (
    <span className="inline-flex items-center justify-center gap-2 [text-decoration:inherit]">
      {busy ? <Spinner /> : emoji ? <Emoji>{emoji}</Emoji> : null}
      {children}
    </span>
  );
}
