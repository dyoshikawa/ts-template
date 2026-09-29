// Stands in for `cloudflare:workers` under Vitest (see `vitest.config.ts`):
// modules read bindings and variables from `env`, and a test sets what it
// needs on this object and clears it again afterwards.
export const env = {} as Cloudflare.Env;
