// Stands in for `cloudflare:workers` under Vitest (see `vitest.config.ts`):
// modules read bindings and variables from `env`, and a test sets what it
// needs on this object and clears it again afterwards.
export const env = {} as Cloudflare.Env;

/** The Workers runtime keeps the Worker alive for these; tests have nothing to wait for. */
export function waitUntil(_promise: Promise<unknown>): void {}
