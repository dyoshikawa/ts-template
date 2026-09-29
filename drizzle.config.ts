import { defineConfig } from "drizzle-kit";

// Migrations are generated into `drizzle/` and applied to D1 with
// `wrangler d1 migrations apply` (see `db:migrate:*` in package.json), so no
// database credentials are needed here.
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
});
