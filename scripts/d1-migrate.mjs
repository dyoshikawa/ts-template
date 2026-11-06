// Applies the migrations in `drizzle/` to the D1 database with
// `cf d1 migrations apply` (which keeps track of what has run in the
// database's `d1_migrations` table):
//
//   node scripts/d1-migrate.mjs                  # the deployed database
//   node scripts/d1-migrate.mjs --local [--persist-to .cloudflare/state]
//
// `cf` identifies a database by its id only (no binding or database name),
// so the id is read from the `DB` binding in `cloudflare.config.ts` and lives
// in that one file. Run without a terminal, `cf` applies without asking.
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const ROOT = join(import.meta.dirname, "..");

/** The `DB` binding's database id in `cloudflare.config.ts`. */
async function databaseId() {
  const { default: config } = await import("../cloudflare.config.ts");
  const resolved = typeof config === "function" ? config({ mode: "production" }) : config;
  return resolved.worker.env.DB.id;
}

/**
 * Applies the pending migrations; `persistTo` (local runs only) is the state
 * folder of the local database. Returns the exit status of `cf`.
 */
export async function applyMigrations({ local = false, persistTo } = {}) {
  const args = ["exec", "cf", "d1", "migrations", "apply", await databaseId(), "--dir", "drizzle"];
  if (local) {
    args.push("--local", "--persist-to", resolve(ROOT, persistTo ?? join(".cloudflare", "state")));
  }
  const result = spawnSync("pnpm", args, { cwd: ROOT, stdio: "inherit", shell: false });
  return result.status ?? 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({
    options: {
      local: { type: "boolean", default: false },
      "persist-to": { type: "string" },
    },
  });
  process.exit(await applyMigrations({ local: values.local, persistTo: values["persist-to"] }));
}
