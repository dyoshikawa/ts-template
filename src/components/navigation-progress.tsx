import { useRouterState } from "@tanstack/react-router";

/**
 * A thin bar along the top while the next page loads (every navigation asks
 * the server for the session first), so a tapped link shows that something
 * is on its way. It covers nothing, so the page stays usable meanwhile.
 */
export function NavigationProgress() {
  const loading = useRouterState({ select: (state) => state.status === "pending" });
  if (!loading) {
    return null;
  }
  return (
    <div
      aria-hidden="true"
      data-testid="navigation-progress"
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5 animate-pulse bg-blue-600 dark:bg-blue-400"
    />
  );
}
