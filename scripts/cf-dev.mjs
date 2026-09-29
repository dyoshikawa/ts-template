// Runs the production bundle in the Cloudflare emulator (workerd through
// `wrangler dev`) with local D1 and Email Service: the closest thing to
// the deployed Worker that runs on a laptop. `pnpm dev` (Vite) is quicker for
// day-to-day work; this catches what only shows up in the built bundle.
//
//   node scripts/cf-dev.mjs [--vars .dev.vars] [--state .wrangler/state]
//                           [--port 4173] [--fresh] [--no-build]
//
// The variables file is copied next to the built Worker config, where
// wrangler picks it up as `.dev.vars` (a path passed as `--env-file` would be
// swallowed by Node's own `--env-file` option). Migrations are applied to
// the local database first; `--fresh` wipes the state directory beforehand.
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";

const ROOT = join(import.meta.dirname, "..");
const BUILT_CONFIG = join(ROOT, "dist", "server", "wrangler.json");

const { values } = parseArgs({
  options: {
    vars: { type: "string", default: ".dev.vars" },
    state: { type: "string", default: join(".wrangler", "state") },
    port: { type: "string", default: "4173" },
    fresh: { type: "boolean", default: false },
    build: { type: "boolean", default: true },
  },
  allowNegative: true,
});

const varsFile = resolve(ROOT, values.vars);
const stateDir = resolve(ROOT, values.state);

function run(command, args) {
  const result = spawnSync(command, args, { cwd: ROOT, stdio: "inherit", shell: false });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (values.fresh) {
  rmSync(stateDir, { recursive: true, force: true });
}
if (values.build) {
  run("pnpm", ["exec", "vite", "build"]);
}
if (!existsSync(BUILT_CONFIG)) {
  // oxlint-disable-next-line no-console
  console.error(`No built Worker at ${BUILT_CONFIG}; run without --no-build.`);
  process.exit(1);
}
if (existsSync(varsFile)) {
  copyFileSync(varsFile, join(ROOT, "dist", "server", ".dev.vars"));
} else {
  // oxlint-disable-next-line no-console
  console.warn(`No variables file at ${varsFile}; running with the config vars only.`);
}
run("pnpm", [
  "exec",
  "wrangler",
  "d1",
  "migrations",
  "apply",
  "DB",
  "--local",
  "--persist-to",
  stateDir,
]);
run("pnpm", [
  "exec",
  "wrangler",
  "dev",
  "--config",
  BUILT_CONFIG,
  "--persist-to",
  stateDir,
  "--port",
  values.port,
]);
