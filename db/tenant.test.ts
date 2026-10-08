import { randomUUID } from "node:crypto";

import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { client, withTenant } from "./client";
import { organizations, users } from "./schema";

/**
 * RLS isolation test.
 *
 * Requires a real PostgreSQL/Neon database reachable via DATABASE_URL.
 * Run with: npm run db:test
 *
 * Asserts that withTenant() strictly scopes reads to a single organization and
 * that a query under the non-privileged `app_tenant` role with no tenant
 * context sees ZERO rows. (The raw owner connection legitimately bypasses RLS
 * on Neon, so "no tenant => zero rows" is asserted via the app_tenant role.)
 */

const orgAId = randomUUID();
const orgBId = randomUUID();

const userAEmail = `a-${orgAId}@example.test`;
const userBEmail = `b-${orgBId}@example.test`;

beforeAll(async () => {
  // Create the two organizations (each matches its own tenant id so the
  // organizations RLS WITH CHECK is satisfied when created under that tenant).
  await withTenant(orgAId, async (tx) => {
    await tx
      .insert(organizations)
      .values({ id: orgAId, name: "Organization A" })
      .onConflictDoNothing({ target: organizations.id });
    await tx
      .insert(users)
      .values({
        organizationId: orgAId,
        email: userAEmail,
        role: "owner",
      })
      .onConflictDoNothing({ target: users.email });
  });

  await withTenant(orgBId, async (tx) => {
    await tx
      .insert(organizations)
      .values({ id: orgBId, name: "Organization B" })
      .onConflictDoNothing({ target: organizations.id });
    await tx
      .insert(users)
      .values({
        organizationId: orgBId,
        email: userBEmail,
        role: "owner",
      })
      .onConflictDoNothing({ target: users.email });
  });
});

afterAll(async () => {
  // Best-effort cleanup inside each tenant's context.
  // NOTE: we must delete the users BEFORE the organization because the
  // users.organization_id FK is ON DELETE RESTRICT. Deleting the org removes
  // the leak that earlier versions of this test left behind.
  for (const [orgId, email] of [
    [orgAId, userAEmail],
    [orgBId, userBEmail],
  ] as const) {
    await withTenant(orgId, async (tx) => {
      await tx.delete(users).where(eq(users.email, email));
      await tx.delete(organizations).where(eq(organizations.id, orgId));
    });
  }
  await client.end();
});

describe("multi-tenant RLS isolation", () => {
  it("withTenant(A) returns only A's user", async () => {
    const rows = await withTenant(orgAId, (tx) => tx.select().from(users));

    expect(rows).toHaveLength(1);
    expect(rows[0].email).toBe(userAEmail);
    expect(rows[0].organizationId).toBe(orgAId);
  });

  it("withTenant(B) returns only B's user", async () => {
    const rows = await withTenant(orgBId, (tx) => tx.select().from(users));

    expect(rows).toHaveLength(1);
    expect(rows[0].email).toBe(userBEmail);
    expect(rows[0].organizationId).toBe(orgBId);
  });

  it("no tenant context (as app_tenant) returns zero rows (RLS enforced)", async () => {
    // The application runs tenant queries as the non-privileged `app_tenant`
    // role (see withTenant). A query with the role switched but NO tenant
    // setting must therefore see zero rows.
    //
    // NOTE: we deliberately do NOT use the raw `db` connection here. On Neon
    // the connecting owner role (`neondb_owner`) has BYPASSRLS=true, so it
    // would see all rows regardless of RLS — that is expected and is why the
    // app switches to `app_tenant` inside withTenant().

    // Case 1: setting unset (NULL) -> zero rows.
    const unsetRows = await withTenant(orgAId, async (tx) => {
      await tx.execute(
        sql`select set_config('app.current_organization_id', null, true)`,
      );
      return tx.select().from(users);
    });
    expect(unsetRows).toHaveLength(0);

    // Case 2: setting explicitly empty string -> zero rows (not an error),
    // guaranteed by the NULLIF guard in migration 0002.
    const emptyRows = await withTenant(orgAId, async (tx) => {
      await tx.execute(
        sql`select set_config('app.current_organization_id', '', true)`,
      );
      return tx.select().from(users);
    });
    expect(emptyRows).toHaveLength(0);
  });

  it("withTenant throws when organizationId is falsy", async () => {
    await expect(
      withTenant("", async (tx) => tx.select().from(users)),
    ).rejects.toThrow(/organizationId is required/);

    await expect(
      // Intentionally passing an empty value to exercise the guard.
      withTenant(undefined as unknown as string, async (tx) =>
        tx.select().from(users),
      ),
    ).rejects.toThrow(/organizationId is required/);
  });
});
