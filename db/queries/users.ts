import { eq } from "drizzle-orm";

import { db, withTenant } from "../client";
import { organizations, users } from "../schema";

/**
 * The organization every OAuth sign-in is attached to by default.
 *
 * Captured from the seeded organization ("Blackcat.petsitter"). Prefer the
 * DEFAULT_ORG_ID environment variable in production; the hard-coded value is
 * the deterministic id produced by the seed and serves as a local fallback.
 */
export const DEFAULT_ORG_ID =
  process.env.DEFAULT_ORG_ID ?? "c6737341-dcb9-4266-92ae-cdb972d382f9";

/** A user row as used by the auth layer. */
export type AuthUserRow = {
  id: string;
  organizationId: string;
  email: string;
  googleId: string | null;
  role: "user" | "owner" | "staff";
};

/**
 * Find a user by email using the PLAIN db client (no tenant context).
 *
 * Used by NextAuth (signIn/jwt callbacks) which run before a tenant context
 * exists. The plain client connects as the owner role, which bypasses RLS, so
 * it can resolve a user across tenants.
 */
export async function findUserByEmail(
  email: string,
): Promise<AuthUserRow | null> {
  const row = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  if (!row) return null;

  return {
    id: row.id,
    organizationId: row.organizationId,
    email: row.email,
    googleId: row.googleId,
    role: row.role,
  };
}

/**
 * Insert a user on first OAuth sign-in, using the PLAIN db client.
 *
 * - `onConflictDoNothing` on the unique `email`: if the user already exists,
 *   NOTHING is changed. We deliberately do NOT upsert the role (no
 *   ON CONFLICT DO UPDATE) so an existing role is never overwritten by a
 *   later login.
 * - New users default to role 'user' and DEFAULT_ORG_ID.
 *
 * Returns the persisted row (existing or newly created).
 */
export async function upsertUserFromOAuth(input: {
  email: string;
  googleId?: string | null;
  name?: string | null;
}): Promise<AuthUserRow | null> {
  const { email, googleId } = input;

  const [inserted] = await db
    .insert(users)
    .values({
      email,
      googleId: googleId ?? null,
      role: "user",
      organizationId: DEFAULT_ORG_ID,
    })
    .onConflictDoNothing({ target: users.email })
    .returning();

  // If the insert was a no-op (user already existed) fall back to a read.
  if (inserted) {
    return {
      id: inserted.id,
      organizationId: inserted.organizationId,
      email: inserted.email,
      googleId: inserted.googleId,
      role: inserted.role,
    };
  }

  return findUserByEmail(email);
}

/**
 * Fetch a user's profile within a single tenant, using withTenant.
 *
 * STRICT: `organizationId` is required — withTenant throws if it is missing.
 * RLS ensures that a user belonging to another organization is NOT visible,
 * so a cross-tenant lookup returns null.
 */
export async function getUserProfile(
  organizationId: string,
  userId: string,
): Promise<AuthUserRow | null> {
  return withTenant(organizationId, async (tx) => {
    const row = await tx.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!row) return null;

    return {
      id: row.id,
      organizationId: row.organizationId,
      email: row.email,
      googleId: row.googleId,
      role: row.role,
    };
  });
}

/**
 * Fetch the organization name (for the dashboard). Tenant-scoped via
 * withTenant so only the caller's own organization row is visible.
 */
export async function getOrganizationName(
  organizationId: string,
): Promise<string | null> {
  return withTenant(organizationId, async (tx) => {
    const row = await tx.query.organizations.findFirst({
      where: eq(organizations.id, organizationId),
    });
    return row?.name ?? null;
  });
}
