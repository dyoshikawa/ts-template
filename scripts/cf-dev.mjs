// Runs the production bundle in the Cloudflare emulator (workerd through the
// Cloudflare Vite plugin's `vp preview`) with local D1 and Email Service: the
// closest thing to the deployed Worker that runs on a laptop. `pnpm dev`
// (Vite) is quicker for day-to-day work; this catches what only shows up in
// the built bundle.
//
//   node scripts/cf-dev.mjs [--vars .dev.vars] [--state .cloudflare/state]
//                           [--port 4173] [--inspector-port 9229]
//                           [--fresh] [--no-build]
//
// The variables file is copied into a folder of this run's own
// (`CF_DEV_ENV_DIR`), and the bundle is built in the `emulator` mode, in
// which `cloudflare.config.ts` records those variables in the Build Output
// that the preview runs — so `--no-build` keeps the variables of the last
// build. Migrations are applied to the local database first; `--fresh` wipes
// the state directory beforehand.
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";

import { applyMigrations } from "./d1-migrate.mjs";

const ROOT = join(import.meta.dirname, "..");
const BUILT_CONFIG = join(
  ROOT,
  ".cloudflare",
  "output",
  "v0",
  "workers",
  "default",
  "worker.config.json",
);

const { values } = parseArgs({
  options: {
    vars: { type: "string", default: ".dev.vars" },
    state: { type: "string", default: join(".cloudflare", "state") },
    port: { type: "string", default: "4173" },
    "inspector-port": { type: "string" },
    fresh: { type: "boolean", default: false },
    build: { type: "boolean", default: true },
  },
  allowNegative: true,
});

const varsFile = resolve(ROOT, values.vars);
const stateDir = resolve(ROOT, values.state);
const envDir = join(ROOT, ".cloudflare", "tmp", `cf-dev-${values.port}`);

function run(command, args, env = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    stdio: "inherit",
    shell: false,
    env: { ...process.env, ...env },
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (values.fresh) {
  rmSync(stateDir, { recursive: true, force: true });
}
if (values.build) {
  rmSync(envDir, { recursive: true, force: true });
  mkdirSync(envDir, { recursive: true });
  if (existsSync(varsFile)) {
    copyFileSync(varsFile, join(envDir, ".dev.vars"));
  } else {
    // oxlint-disable-next-line no-console
    console.warn(`No variables file at ${varsFile}; running with the config vars only.`);
  }
  run("pnpm", ["exec", "vp", "build", "--mode", "emulator"], { CF_DEV_ENV_DIR: envDir });
}
if (!existsSync(BUILT_CONFIG)) {
  // oxlint-disable-next-line no-console
  console.error(`No built Worker at ${BUILT_CONFIG}; run without --no-build.`);
  process.exit(1);
}
const migrated = await applyMigrations({ local: true, persistTo: stateDir });
if (migrated !== 0) {
  process.exit(migrated);
}
run("pnpm", ["exec", "vp", "preview", "--port", values.port, "--strictPort"], {
  CF_DEV_STATE: stateDir,
  ...(values["inspector-port"] ? { CF_DEV_INSPECTOR_PORT: values["inspector-port"] } : {}),
});
