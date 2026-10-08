import { sql } from "drizzle-orm";
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

// Load environment for standalone scripts (seed/migrate/tests) and local dev.
// In production Fly.io injects real env vars, so these calls are no-ops.
config({ path: ".env" });
config({ path: ".env.local", override: true });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env and provide a value.",
  );
}

/**
 * Low-level postgres.js client.
 *
 * We deliberately use the `postgres` (postgres.js) driver rather than
 * `@neondatabase/serverless`, because Row-Level Security depends on
 * session-scoped variables (`SET LOCAL app.current_organization_id`),
 * which require a real, persistent session/connection. The pooled Neon
 * connection string in DATABASE_URL is still used; postgres.js talks to
 * the pooler over the standard wire protocol.
 */
export const client = postgres(connectionString, {
  // Keep a small pool; transactions hold a dedicated connection.
  max: 10,
  idle_timeout: 20,
  // `prepare: false` is required when talking through Neon's PgBouncer
  // pooler in transaction mode (prepared statements are not supported).
  prepare: false,
});

/**
 * Plain Drizzle client with NO tenant context.
 *
 * Use this for:
 *   - NextAuth lookups (e.g. finding a user by email during sign-in),
 *   - running migrations,
 *   - administrative/system tasks.
 *
 * It is NOT tenant-scoped. Any query touching a table with RLS enabled
 * (organizations, users, bookings, transport_fee_rules) will return ZERO
 * rows here, because no `app.current_organization_id` is set. That is the
 * intended strict behaviour.
 */
export const db = drizzle(client, { schema });

/** The transaction handle passed to `withTenant` callbacks. */
export type TenantTransaction = Parameters<
  Parameters<typeof db.transaction>[0]
>[0];

/**
 * Run `fn` inside a transaction scoped to a single organization.
 *
 * Sets `app.current_organization_id` for the duration of the transaction
 * using `set_config(..., true)`, which is equivalent to `SET LOCAL` but is
 * safely parameterized (no SQL injection via the org id). The setting is
 * reset automatically when the transaction commits or rolls back.
 *
 * Strict mode: if `organizationId` is missing/empty/falsy the function
 * throws before opening a transaction, rather than silently running with
 * no tenant context (which would otherwise return zero rows via RLS).
 */
export async function withTenant<T>(
  organizationId: string,
  fn: (tx: TenantTransaction) => Promise<T>,
): Promise<T> {
  if (!organizationId || organizationId.trim() === "") {
    throw new Error(
      "withTenant: organizationId is required and must be a non-empty string",
    );
  }

  return db.transaction(async (tx) => {
    // 1. Set the tenant context for this transaction (LOCAL => auto-reset).
    //    set_config(setting, value, is_local) — `true` scopes it to this tx.
    await tx.execute(
      sql`select set_config('app.current_organization_id', ${organizationId}, true)`,
    );
    // 2. Drop privileges for the rest of the transaction by switching to the
    //    non-privileged role created in migration 0001. This is REQUIRED on
    //    Neon: the connecting owner role (`neondb_owner`) has BYPASSRLS=true,
    //    which ignores RLS entirely. `app_tenant` is NOBYPASSRLS, so the
    //    tenant policies actually apply. SET LOCAL ROLE reverts on
    //    COMMIT/ROLLBACK, so the connection returns to the owner afterwards.
    await tx.execute(sql`set local role app_tenant`);
    return fn(tx);
  });
}
