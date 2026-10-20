import { and, eq } from "drizzle-orm";

import { withTenant } from "../client";
import { addresses, users } from "../schema";

/**
 * Tenant-scoped address queries for the /api/addresses endpoints.
 *
 * IMPORTANT — how tenancy is enforced:
 * `addresses` has NO RLS (by design). Isolation is inherited through the FK
 * chain `addresses.user_id -> users.organization_id`, and `users` IS
 * RLS-protected (FORCE). Every query here JOINS `users` and filters on
 * `users.organizationId` + `user_id`, all inside `withTenant`. A bare
 * `SELECT ... FROM addresses WHERE user_id=$1` would NOT be tenant-scoped.
 */

/** A full address row (all schema columns) as returned by the addresses API. */
export type Address = typeof addresses.$inferSelect;

export type CreateAddressInput = {
  label?: string | null;
  fullAddress: string;
};

/**
 * List all addresses owned by `userId` within `organizationId`.
 *
 * Tenancy + ownership enforced by the `users` join (org match) and the
 * `user_id` filter, inside withTenant.
 */
export async function listAddressesByUser(
  organizationId: string,
  userId: string,
): Promise<Address[]> {
  return withTenant(organizationId, async (tx) => {
    return tx
      .select()
      .from(addresses)
      .innerJoin(users, eq(addresses.userId, users.id))
      .where(
        and(
          eq(addresses.userId, userId),
          eq(users.organizationId, organizationId),
        ),
      )
      .orderBy(addresses.createdAt)
      .then((rows) => rows.map((r) => r.addresses));
  });
}

/**
 * Create an address owned by `userId` within `organizationId`.
 *
 * GUARD: `addresses` has no RLS, so we first confirm the user is a member of
 * this organization (via the RLS-protected `users` table) before inserting,
 * preventing an address from being attached to a user in another tenant.
 *
 * The transport/MTR fields (nearestMtr, walkingMinutes,
 * requiresTransportChange, accessTier, surchargeHkd, transportModes) are left
 * NULL — the owner fills them during quote review.
 */
export async function createAddress(
  organizationId: string,
  userId: string,
  input: CreateAddressInput,
): Promise<Address> {
  return withTenant(organizationId, async (tx) => {
    const [owner] = await tx
      .select({ id: users.id })
      .from(users)
      .where(
        and(eq(users.id, userId), eq(users.organizationId, organizationId)),
      )
      .limit(1);

    if (!owner) {
      const err = new Error("User not found in this organization") as Error & {
        code?: string;
      };
      err.code = "P0001";
      throw err;
    }

    const [row] = await tx
      .insert(addresses)
      .values({
        userId,
        label: input.label ?? null,
        fullAddress: input.fullAddress,
      })
      .returning();
    return row;
  });
}
