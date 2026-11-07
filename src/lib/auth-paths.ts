/** Where Better Auth's endpoints are served (its default `basePath`). */
const AUTH_BASE_PATH = "/api/auth";

/**
 * The paths a request under {@link AUTH_BASE_PATH} may reach Better Auth
 * with: every endpoint of the instance (`auth.api`, plugins included) except
 * the switched-off ones and those with a path parameter
 * (`/reset-password/:token`, `/callback/:id`), which the app does not use
 * (see `DISABLED_AUTH_PATHS`).
 */
export function authEndpointPaths({
  endpoints,
  disabled,
}: {
  endpoints: Record<string, unknown>;
  disabled: readonly string[];
}): ReadonlySet<string> {
  const off = new Set(disabled);
  const paths = new Set<string>();
  for (const endpoint of Object.values(endpoints)) {
    const { path } = (endpoint ?? {}) as { path?: unknown };
    if (typeof path === "string" && !path.includes(":") && !off.has(path)) {
      paths.add(path);
    }
  }
  return paths;
}

/**
 * Whether a request is for one of Better Auth's endpoints, its path
 * normalized the way Better Auth does (base path removed, trailing slashes
 * dropped).
 *
 * Better Auth's rate limiter counts every request in D1 before it looks for
 * a matching endpoint, keyed on the client address and the path: a request
 * to a made-up path would add a row per path, never be limited, and get a
 * 404 anyway. Answering such requests before Better Auth runs keeps the
 * table to one row per client and endpoint.
 */
export function isAuthEndpointRequest({
  url,
  paths,
}: {
  url: string;
  paths: ReadonlySet<string>;
}): boolean {
  const { pathname } = new URL(url);
  if (!pathname.startsWith(`${AUTH_BASE_PATH}/`)) {
    return false;
  }
  const path = pathname.slice(AUTH_BASE_PATH.length).replace(/\/+$/, "");
  return paths.has(path);
}
