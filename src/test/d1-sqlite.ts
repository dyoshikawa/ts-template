// A D1 database for unit tests, on Node's built-in SQLite (`node:sqlite`),
// with the app's migrations applied: enough of D1's API for Drizzle's d1
// driver (prepare / bind / all / raw / run / first, and batch as one
// transaction). Tests that use it run with `// @vitest-environment node`.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";

const MIGRATIONS = join(import.meta.dirname, "..", "..", "drizzle");

export type TestD1 = { d1: D1Database; sqlite: DatabaseSync };

type Bound = {
  bind: (...params: unknown[]) => Bound;
  all: () => Promise<{ results: unknown[]; success: true; meta: object }>;
  raw: () => Promise<unknown[][]>;
  run: () => Promise<{ results: []; success: true; meta: { changes: number } }>;
  first: () => Promise<unknown>;
};

export function createTestD1(): TestD1 {
  const sqlite = new DatabaseSync(":memory:");
  for (const file of readdirSync(MIGRATIONS)
    .filter((name) => name.endsWith(".sql"))
    .toSorted()) {
    for (const statement of readFileSync(join(MIGRATIONS, file), "utf8").split(
      "--> statement-breakpoint",
    )) {
      if (statement.trim() !== "") {
        sqlite.exec(statement);
      }
    }
  }

  const statement = (query: string, params: unknown[]): Bound => {
    // SQLite has no booleans; D1 stores them as 0 / 1.
    const values = params.map((value) =>
      typeof value === "boolean" ? Number(value) : value,
    ) as SQLInputValue[];
    return {
      bind: (...next) => statement(query, next),
      all: async () => ({ results: sqlite.prepare(query).all(...values), success: true, meta: {} }),
      raw: async () => {
        const prepared = sqlite.prepare(query);
        prepared.setReturnArrays(true);
        return prepared.all(...values) as unknown as unknown[][];
      },
      run: async () => ({
        results: [],
        success: true,
        meta: { changes: Number(sqlite.prepare(query).run(...values).changes) },
      }),
      first: async () => sqlite.prepare(query).get(...values) ?? null,
    };
  };
  const d1 = {
    prepare: (query: string) => statement(query, []),
    batch: async (statements: Bound[]) => {
      sqlite.exec("begin");
      try {
        const results = [];
        for (const bound of statements) {
          results.push(await bound.all());
        }
        sqlite.exec("commit");
        return results;
      } catch (error) {
        sqlite.exec("rollback");
        throw error;
      }
    },
  } as unknown as D1Database;
  return { d1, sqlite };
}
