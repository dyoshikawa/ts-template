import handler from "@tanstack/react-start/server-entry";

import { withSecurityHeaders } from "./lib/security-headers";

/**
 * The Worker's entry: TanStack Start answers requests with the security
 * headers added. Add `scheduled` or `queue` handlers here when the app needs them.
 */
export default {
  fetch: async (request: Request) => withSecurityHeaders(await handler.fetch(request)),
} satisfies ExportedHandler<Env>;
