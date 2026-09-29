import { type KnipConfig } from "knip";

const config: KnipConfig = {
  // Routes are reached through TanStack Router's generated route tree, test
  // files are not covered by any enabled plugin, and the Workers stand-in is
  // reached through a Vitest alias.
  entry: ["src/routes/**/*.tsx", "src/**/*.test.{ts,tsx}", "src/test/cloudflare-workers.ts"],
  project: ["src/**/*.{ts,tsx,css}"],
  ignoreDependencies: [
    // Referenced from .secretlintrc.json rather than imported from source.
    "@secretlint/secretlint-rule-preset-recommend",
    // `cloudflare:workers` is a Workers runtime module, not an npm package.
    "cloudflare",
  ],
};

export default config;
