import { defineConfig, lazyPlugins } from "vite-plus";

// One file configures the whole Vite+ toolchain: the app build (`vp dev`,
// `vp build`), the formatter (`fmt`), the linter (`lint`) and the pre-commit
// checks (`staged`). The unit tests have their own `vitest.config.ts`.
export default defineConfig({
  // `lazyPlugins` loads and builds the plugins only for `vp dev` / `vp build`:
  // `vp fmt`, `vp lint` and `vp check` read this file for the blocks below,
  // and importing the Cloudflare plugin (wrangler) alone takes seconds.
  plugins: lazyPlugins(async () => {
    const [{ cloudflare }, { default: tailwindcss }, { tanstackStart }, { default: viteReact }] =
      await Promise.all([
        import("@cloudflare/vite-plugin"),
        import("@tailwindcss/vite"),
        import("@tanstack/react-start/plugin/vite"),
        import("@vitejs/plugin-react"),
      ]);
    return [
      // `viteEnvironment.name: "ssr"` runs TanStack Start's SSR environment inside
      // the Worker, so `wrangler deploy` ships exactly what Vite builds.
      cloudflare({ viteEnvironment: { name: "ssr" } }),
      tailwindcss(),
      tanstackStart(),
      viteReact(),
    ];
  }),

  // `vp fmt` (Oxfmt).
  fmt: {
    printWidth: 100,
    tabWidth: 2,
    useTabs: false,
    semi: true,
    singleQuote: false,
    trailingComma: "all",
    arrowParens: "always",
    experimentalSortImports: {},
    ignorePatterns: [
      "package.json",
      "src/routeTree.gen.ts",
      "drizzle/**",
      "worker-configuration.d.ts",
      "node_modules/**",
      "dist/**",
      ".vscode/settings.json",
      ".claude/settings.json",
      "opencode.jsonc",
      ".github/copilot-instructions.md",
      ".github/instructions/**",
      "rulesync.local.jsonc",
    ],
    overrides: [
      {
        files: ["**/*.json", "**/*.jsonc"],
        options: { trailingComma: "none" },
      },
    ],
  },

  // `vp lint` (Oxlint). Type checking stays with `tsc` (`pnpm typecheck`):
  // Oxlint's type-aware mode would add rules the template does not use.
  lint: {
    plugins: ["typescript", "import", "unicorn", "react", "jsx-a11y"],
    // Vite+'s own rule, which reports `vite` / `vitest` imports that should
    // come from `vite-plus`.
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    categories: {
      correctness: "error",
      suspicious: "warn",
      style: "off",
      pedantic: "off",
    },
    rules: {
      complexity: ["error", { max: 20 }],
      eqeqeq: "error",
      "import/no-cycle": "error",
      "no-console": "error",
      "no-new": "off",
      "no-underscore-dangle": "off",
      // The automatic JSX runtime makes importing React unnecessary.
      "react/react-in-jsx-scope": "off",
      "typescript/no-explicit-any": "warn",
      "unicorn/prefer-node-protocol": "error",
      "unicorn/no-array-reduce": "off",
      "vite-plus/prefer-vite-plus-imports": "error",
    },
    env: {
      browser: true,
      node: true,
      es2024: true,
    },
    ignorePatterns: ["dist/**", "coverage/**", "*.d.ts", "node_modules/**", "src/routeTree.gen.ts"],
    overrides: [
      {
        files: ["**/*.test.ts", "**/*.test.tsx"],
        rules: {
          "typescript/no-explicit-any": "off",
        },
      },
    ],
  },

  // `vp staged`, run by the pre-commit hook (`.vite-hooks/pre-commit`).
  staged: {
    "*": "npx secretlint",
    "package.json": "npx sort-package-json",
    // Regenerate AI tool configurations when rulesync source files change.
    ".rulesync/**/*": () => "pnpm generate",
  },
});
