import { randomUUID } from "node:crypto";

import { and, eq, inArray, isNull } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { client, db, withTenant } from "./client";
import { getPetInTenant, listPetDocuments } from "./queries/pets";
import { getUserProfile } from "./queries/users";
import {
  bookingEvents,
  bookings,
  organizations,
  petDocuments,
  pets,
  users,
} from "./schema";
import {
  checkConditionalTypeRules,
  isQuarantineKeyForPet,
} from "../lib/documents";

/**
 * Cross-tenant test for the auth + document read path.
 *
 * Seeds two organizations (A and B), each with one user and one pet, then
 * verifies:
 *   1. getUserProfile() can only ever see the caller's tenant.
 *   2. pet_documents inserts are tenant-scoped via withTenant (RLS inheritance).
 *   3. Conditional upload + quarantine-key validation rules.
 *   4. Icon uniqueness (soft-delete prior active icon).
 *   5. Cross-tenant pet access is invisible (drives the route's 404).
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

// Pet ids (one per org) resolved/created in beforeAll.
const petAId = randomUUID();
const petBId = randomUUID();

beforeAll(async () => {
  // Organization A + its user + a cat (not vaccinated).
  const [userA] = await withTenant(orgAId, async (tx) => {
    await tx
      .insert(organizations)
      .values({ id: orgAId, name: "Auth Org A" })
      .onConflictDoNothing({ target: organizations.id });
    const [u] = await tx
      .insert(users)
      .values({ organizationId: orgAId, email: userAEmail, role: "owner" })
      .onConflictDoNothing({ target: users.email })
      .returning();
    await tx
      .insert(pets)
      .values({
        id: petAId,
        userId: u!.id,
        name: "A-Cat",
        type: "cat",
        vaccinated: false,
      })
      .onConflictDoNothing({ target: pets.id });
    return [u];
  });

  // Organization B + its user + a dog (vaccinated).
  const [userB] = await withTenant(orgBId, async (tx) => {
    await tx
      .insert(organizations)
      .values({ id: orgBId, name: "Auth Org B" })
      .onConflictDoNothing({ target: organizations.id });
    const [u] = await tx
      .insert(users)
      .values({ organizationId: orgBId, email: userBEmail, role: "owner" })
      .onConflictDoNothing({ target: users.email })
      .returning();
    await tx
      .insert(pets)
      .values({
        id: petBId,
        userId: u!.id,
        name: "B-Dog",
        type: "dog",
        vaccinated: true,
      })
      .onConflictDoNothing({ target: pets.id });
    return [u];
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
  // SAFETY: pets / addresses / pet_documents / booking_events have NO RLS, so
  // an UNSCOPED delete would wipe the entire table (including real data).
  // Every delete below is scoped to the rows THIS test created.
  //
  // First: purge any bookings referencing this run's pets via the owner client
  // (bypasses RLS), because bookings.pet_id is ON DELETE RESTRICT and a stale
  // booking in any tenant would otherwise block the pets delete.
  const petIds = [petAId, petBId];
  const stale = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(inArray(bookings.petId, petIds));
  if (stale.length > 0) {
    const ids = stale.map((b) => b.id);
    await db.delete(bookingEvents).where(inArray(bookingEvents.bookingId, ids));
    await db.delete(bookings).where(inArray(bookings.id, ids));
  }

  // Then delete this test's rows in each tenant, strictly scoped.
  for (const [orgId, email] of [
    [orgAId, userAEmail],
    [orgBId, userBEmail],
  ] as const) {
    await withTenant(orgId, async (tx) => {
      const [u] = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      await tx
        .delete(petDocuments)
        .where(inArray(petDocuments.petId, [petAId, petBId]));
      await tx.delete(pets).where(inArray(pets.id, [petAId, petBId]));

      if (u) {
        const ownBookings = await tx
          .select({ id: bookings.id })
          .from(bookings)
          .where(eq(bookings.userId, u.id));
        if (ownBookings.length > 0) {
          const ids = ownBookings.map((b) => b.id);
          await tx
            .delete(bookingEvents)
            .where(inArray(bookingEvents.bookingId, ids));
          await tx.delete(bookings).where(inArray(bookings.id, ids));
        }
      }

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

describe("pet_documents tenant isolation", () => {
  it("inserts a document via withTenant(A) for a pet in org A", async () => {
    const row = await withTenant(orgAId, async (tx) => {
      const [doc] = await tx
        .insert(petDocuments)
        .values({
          petId: petAId,
          type: "medical",
          r2Key: `pets/${petAId}/medical/${randomUUID()}.pdf`,
          mimeType: "application/pdf",
          sizeBytes: 1234,
          uploadedBy: sessionA.user.id,
        })
        .returning();
      return doc;
    });

    expect(row).toBeDefined();
    expect(row?.petId).toBe(petAId);

    // Cleanup this row so later icon tests start clean.
    await withTenant(orgAId, async (tx) => {
      await tx.delete(petDocuments).where(eq(petDocuments.id, row!.id));
    });
  });

  it("cannot reach another tenant's pet, so the guarded insert path is never taken", async () => {
    // IMPORTANT: pet_documents has NO RLS by design (isolation is inherited via
    // pet -> user -> organization and enforced by withTenant-scoped
    // READS + the application resolving the pet first). A raw INSERT with a
    // valid FK is not blocked by the DB, because FK checks bypass RLS. The
    // guarantee we rely on is therefore: org A cannot resolve org B's pet, so
    // the application never inserts a document for it.
    const crossTenantPet = await getPetInTenant(orgAId, petBId);
    expect(crossTenantPet).toBeNull();

    // And any documents that DO exist for org B's pet are invisible from A.
    await withTenant(orgBId, async (tx) => {
      await tx.insert(petDocuments).values({
        petId: petBId,
        type: "medical",
        r2Key: `pets/${petBId}/medical/${randomUUID()}.pdf`,
        mimeType: "application/pdf",
        sizeBytes: 10,
        uploadedBy: sessionB.user.id,
      });
    });

    const aView = await listPetDocuments(orgAId, petBId);
    expect(aView).toHaveLength(0);

    await withTenant(orgBId, async (tx) => {
      await tx.delete(petDocuments).where(eq(petDocuments.petId, petBId));
    });
  });

  it("listing documents for a pet from another tenant returns none", async () => {
    // Insert a real doc in org B, then prove org A cannot see it.
    await withTenant(orgBId, async (tx) => {
      await tx.insert(petDocuments).values({
        petId: petBId,
        type: "medical",
        r2Key: `pets/${petBId}/medical/${randomUUID()}.pdf`,
        mimeType: "application/pdf",
        sizeBytes: 10,
        uploadedBy: sessionB.user.id,
      });
    });

    const aView = await listPetDocuments(orgAId, petBId);
    expect(aView).toHaveLength(0);

    const bView = await listPetDocuments(orgBId, petBId);
    expect(bView.length).toBeGreaterThan(0);

    // Cleanup org B docs.
    await withTenant(orgBId, async (tx) => {
      await tx.delete(petDocuments).where(eq(petDocuments.petId, petBId));
    });
  });
});

describe("conditional upload rules", () => {
  it("rejects weight_proof for a cat", () => {
    const err = checkConditionalTypeRules("weight_proof", {
      type: "cat",
      vaccinated: true,
    });
    expect(err).toMatch(/dogs/);
  });

  it("allows weight_proof for a dog", () => {
    const err = checkConditionalTypeRules("weight_proof", {
      type: "dog",
      vaccinated: true,
    });
    expect(err).toBeNull();
  });

  it("rejects vaccination for a non-vaccinated pet", () => {
    const err = checkConditionalTypeRules("vaccination", {
      type: "dog",
      vaccinated: false,
    });
    expect(err).toMatch(/vaccinated/);
  });

  it("allows vaccination for a vaccinated pet", () => {
    const err = checkConditionalTypeRules("vaccination", {
      type: "dog",
      vaccinated: true,
    });
    expect(err).toBeNull();
  });

  it("rejects an r2Key that is not under quarantine/{petId}/{type}/", () => {
    const petId = randomUUID();
    expect(
      isQuarantineKeyForPet(`pets/${petId}/medical/x.pdf`, petId, "medical"),
    ).toBe(false);
    expect(
      isQuarantineKeyForPet(
        `quarantine/${petId}/medical/x.pdf`,
        petId,
        "medical",
      ),
    ).toBe(true);
    // Wrong petId in the prefix is also rejected.
    expect(
      isQuarantineKeyForPet(
        `quarantine/${randomUUID()}/medical/x.pdf`,
        petId,
        "medical",
      ),
    ).toBe(false);
  });
});

describe("pet icon uniqueness", () => {
  it("soft-deletes the previous active icon when a new one is inserted", async () => {
    const firstKey = `pets/${petAId}/pet_icon/${randomUUID()}.jpg`;
    const secondKey = `pets/${petAId}/pet_icon/${randomUUID()}.jpg`;

    // First icon.
    await withTenant(orgAId, async (tx) => {
      await tx.insert(petDocuments).values({
        petId: petAId,
        type: "pet_icon",
        r2Key: firstKey,
        mimeType: "image/jpeg",
        sizeBytes: 100,
        uploadedBy: sessionA.user.id,
      });
    });

    // Simulate the confirm flow: soft-delete active icon, then insert the new.
    const newActiveKey = await withTenant(orgAId, async (tx) => {
      await tx
        .update(petDocuments)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(petDocuments.petId, petAId),
            eq(petDocuments.type, "pet_icon"),
            isNull(petDocuments.deletedAt),
          ),
        );
      const [doc] = await tx
        .insert(petDocuments)
        .values({
          petId: petAId,
          type: "pet_icon",
          r2Key: secondKey,
          mimeType: "image/jpeg",
          sizeBytes: 100,
          uploadedBy: sessionA.user.id,
        })
        .returning();
      return doc!.r2Key;
    });

    // Exactly one active icon remains, and it's the new one.
    const active = await withTenant(orgAId, async (tx) =>
      tx
        .select()
        .from(petDocuments)
        .where(
          and(
            eq(petDocuments.petId, petAId),
            eq(petDocuments.type, "pet_icon"),
            isNull(petDocuments.deletedAt),
          ),
        ),
    );
    expect(active).toHaveLength(1);
    expect(active[0].r2Key).toBe(newActiveKey);
    expect(active[0].r2Key).toBe(secondKey);

    // Cleanup.
    await withTenant(orgAId, async (tx) => {
      await tx.delete(petDocuments).where(eq(petDocuments.petId, petAId));
    });
  });
});

describe("cross-tenant pet access (drives route 404)", () => {
  it("getPetInTenant(A, petB) returns null so the route can 404 (not 403)", async () => {
    const visible = await getPetInTenant(orgAId, petBId);
    expect(visible).toBeNull();

    const ownView = await getPetInTenant(orgAId, petAId);
    expect(ownView?.id).toBe(petAId);
  });
});
