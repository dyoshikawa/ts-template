// Wipes the local D1 state shared by `pnpm dev` and `pnpm dev:cf`
// (`.wrangler/state`) and applies the migrations again, for a clean slate.
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const STATE_DIR = join(ROOT, ".wrangler", "state");

rmSync(STATE_DIR, { recursive: true, force: true });
const result = spawnSync(
  "pnpm",
  ["exec", "wrangler", "d1", "migrations", "apply", "DB", "--local", "--persist-to", STATE_DIR],
  { cwd: ROOT, stdio: "inherit" },
);
process.exit(result.status ?? 1);
