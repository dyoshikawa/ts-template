// Wipes the local D1 state shared by `pnpm dev` and `pnpm dev:cf`
// (`.cloudflare/state`) and applies the migrations again, for a clean slate.
import { rmSync } from "node:fs";
import { join } from "node:path";

import { applyMigrations } from "./d1-migrate.mjs";

const STATE_DIR = join(import.meta.dirname, "..", ".cloudflare", "state");

rmSync(STATE_DIR, { recursive: true, force: true });
process.exit(await applyMigrations({ local: true, persistTo: STATE_DIR }));
