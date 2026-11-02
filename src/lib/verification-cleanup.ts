import { lt } from "drizzle-orm";

import { createDb } from "../db/client";
import * as schema from "../db/schema";

/**
 * Deletes expired rows of Better Auth's `verification` table: sign-in codes
 * and passkey challenges. Better Auth only sweeps them while looking a code
 * up, and a passkey challenge handed out to a sign-in page that was left
 * (the email field's autofill asks for one on every visit) is never used,
 * so the nightly Cron Trigger (`scheduled` in src/server.ts) clears them.
 */
export async function deleteExpiredVerifications({
  d1,
  now,
}: {
  d1: D1Database;
  now: Date;
}): Promise<{ deleted: number }> {
  const result = await createDb({ d1 })
    .delete(schema.verification)
    .where(lt(schema.verification.expiresAt, now));
  return { deleted: result.meta.changes };
}
