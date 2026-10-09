import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { client, withTenant } from "./client";
import { getUserProfile } from "./queries/users";
import { organizations, users } from "./schema";

/**
 * Cross-tenant test for the auth -> tenant read path.
 *
 * Seeds two organizations (A and B), each with exactly one user, then
 * simulates a NextAuth session for user A and verifies that getUserProfile()
 * (which uses withTenant / RLS) can only ever see user A — never user B.
 *
 * Requires a real PostgreSQL/Neon database reachable via DATABASE_URL.
 * Run with: npm run db:test
 */

const orgAId = randomUUID();
const orgBId = randomUUID();

const userAEmail = `auth-a-${orgAId}@example.test`;
const userBEmail = `auth-b-${orgBId}@example.test`;

/**
 * Minimal stand-in for the NextAuth JWT payload / Session shape after our
 * callbacks have run. Only the fields necessary for the tenant read path.
 */
type SimulatedSession = {
  user: {
    id: string;
    organizationId: string;
    email: string;
    role: "user" | "owner" | "staff";
  };
};

const sessionA: SimulatedSession = {
  user: {
    id: "", // filled in beforeAll once we know the generated id
    organizationId: orgAId,
    email: userAEmail,
    role: "owner",
  },
};

const sessionB: SimulatedSession = {
  user: {
    id: "",
    organizationId: orgBId,
    email: userBEmail,
    role: "owner",
  },
};

beforeAll(async () => {
  // Organization A + its user.
  const [userA] = await withTenant(orgAId, async (tx) => {
    await tx
      .insert(organizations)
      .values({ id: orgAId, name: "Auth Org A" })
      .onConflictDoNothing({ target: organizations.id });
    return tx
      .insert(users)
      .values({ organizationId: orgAId, email: userAEmail, role: "owner" })
      .onConflictDoNothing({ target: users.email })
      .returning();
  });

  // Organization B + its user.
  const [userB] = await withTenant(orgBId, async (tx) => {
    await tx
      .insert(organizations)
      .values({ id: orgBId, name: "Auth Org B" })
      .onConflictDoNothing({ target: organizations.id });
    return tx
      .insert(users)
      .values({ organizationId: orgBId, email: userBEmail, role: "owner" })
      .onConflictDoNothing({ target: users.email })
      .returning();
  });

  // Resolve ids (inserts may have been no-ops on re-run).
  const a =
    userA ??
    (await withTenant(orgAId, (tx) =>
      tx.query.users.findFirst({ where: eq(users.email, userAEmail) }),
    ));
  const b =
    userB ??
    (await withTenant(orgBId, (tx) =>
      tx.query.users.findFirst({ where: eq(users.email, userBEmail) }),
    ));

  if (!a || !b) throw new Error("Failed to seed users for auth tenant test");

  sessionA.user.id = a.id;
  sessionB.user.id = b.id;
});

afterAll(async () => {
  // Delete users before organizations (FK is ON DELETE RESTRICT).
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

describe("auth tenant scoping via getUserProfile", () => {
  it("returns user A when queried within A's organization", async () => {
    const profile = await getUserProfile(
      sessionA.user.organizationId,
      sessionA.user.id,
    );

    expect(profile).not.toBeNull();
    expect(profile?.id).toBe(sessionA.user.id);
    expect(profile?.email).toBe(userAEmail);
    expect(profile?.organizationId).toBe(orgAId);
  });

  it("returns null for a cross-tenant read (A's context, B's user id)", async () => {
    const profile = await getUserProfile(
      sessionA.user.organizationId,
      sessionB.user.id,
    );

    // RLS blocks the cross-tenant read: either null or an empty result.
    expect(profile).toBeNull();
  });

  it("throws when organizationId is missing", async () => {
    await expect(
      getUserProfile("", sessionA.user.id),
    ).rejects.toThrow(/organizationId is required/);

    await expect(
      getUserProfile(undefined as unknown as string, sessionA.user.id),
    ).rejects.toThrow(/organizationId is required/);
  });
});
