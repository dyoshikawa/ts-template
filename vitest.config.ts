import { join } from "node:path";

import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Vitest uses this file instead of `vite.config.ts`, so the Cloudflare and
  // TanStack Start plugins stay out of the test build — only the JSX transform
  // is needed here.
  plugins: [viteReact()],
  resolve: {
    // The Workers runtime module is not available under Node; modules that
    // read `env` from it get a plain object the tests fill in.
    alias: {
      "cloudflare:workers": join(import.meta.dirname, "src", "test", "cloudflare-workers.ts"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    // Browser tests under `e2e/` belong to Playwright.
    include: ["src/**/*.test.{ts,tsx}"],
    watch: false,
    typecheck: {
      enabled: false,
      include: ["src/**/*.test-d.ts"],
    },
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.test.{ts,tsx}", "src/**/*.test-d.ts", "src/routeTree.gen.ts"],
    },
  },
});
