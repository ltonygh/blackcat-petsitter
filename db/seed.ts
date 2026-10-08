import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";

import { client, db, withTenant } from "./client";
import {
  bookingEvents,
  bookings,
  organizations,
  pets,
  users,
} from "./schema";

/**
 * Seed script.
 *
 * Inserts:
 *   - 1 organization "Blackcat.petsitter"
 *   - 1 owner, 1 staff, 1 regular user (all in that organization)
 *   - 2 pets owned by the regular user
 *   - 1 booking (status: pending) linking the user to the organization
 *   - 1 booking_events row recording the creation
 *
 * IDEMPOTENCY: the organization is resolved by NAME via the owner connection
 * (which bypasses RLS). If it already exists its id is reused; otherwise a new
 * one is created. The remaining writes run through withTenant() (as the
 * non-privileged app_tenant role) so RLS applies. Re-running the seed is safe.
 *
 * Run with: npm run db:seed
 */
const SEED_ORG_NAME = "Blackcat.petsitter";

async function seed() {
  // Resolve (or create) the organization. We use the owner `db` connection
  // here because it has BYPASSRLS and can therefore see whether the org
  // already exists across all tenants. We then insert it under its own
  // tenant context so the organizations RLS WITH CHECK is satisfied.
  console.log("Resolving organization…");
  const existing = await db.query.organizations.findFirst({
    where: eq(organizations.name, SEED_ORG_NAME),
  });

  const organizationId = existing?.id ?? randomUUID();

  if (existing) {
    console.log(`Reusing existing organization ${organizationId}`);
  } else {
    console.log(`Creating organization ${organizationId}`);
  }

  await withTenant(organizationId, async (tx) => {
    // Insert the organization only if this is a fresh id. Inserting inside the
    // tenant context satisfies the organizations RLS WITH CHECK (id == setting).
    if (!existing) {
      await tx
        .insert(organizations)
        .values({ id: organizationId, name: SEED_ORG_NAME })
        .onConflictDoNothing({ target: organizations.id });
    }

    console.log("Seeding users (owner, staff, user)…");

    const [owner] = await tx
      .insert(users)
      .values({
        organizationId,
        email: "owner@blackcat.petsitter",
        googleId: "seed-google-owner",
        role: "owner",
      })
      .onConflictDoNothing({ target: users.email })
      .returning();

    const [staff] = await tx
      .insert(users)
      .values({
        organizationId,
        email: "staff@blackcat.petsitter",
        googleId: "seed-google-staff",
        role: "staff",
      })
      .onConflictDoNothing({ target: users.email })
      .returning();

    const [regularUser] = await tx
      .insert(users)
      .values({
        organizationId,
        email: "user@blackcat.petsitter",
        googleId: "seed-google-user",
        role: "user",
      })
      .onConflictDoNothing({ target: users.email })
      .returning();

    // Fall back to a lookup if the rows already existed (re-run). This now
    // works because the lookup is scoped to the SAME organization id used for
    // the inserts, so the RLS USING predicate matches the existing rows.
    const ownerRow =
      owner ??
      (await tx.query.users.findFirst({
        where: eq(users.email, "owner@blackcat.petsitter"),
      }));
    const staffRow =
      staff ??
      (await tx.query.users.findFirst({
        where: eq(users.email, "staff@blackcat.petsitter"),
      }));
    const userRow =
      regularUser ??
      (await tx.query.users.findFirst({
        where: eq(users.email, "user@blackcat.petsitter"),
      }));

    if (!ownerRow || !staffRow || !userRow) {
      throw new Error("Seed failed: could not resolve seeded users");
    }

    // Idempotency guard: only seed pets/booking once per organization.
    const existingPets = await tx.query.pets.findFirst({
      where: eq(pets.userId, userRow.id),
    });
    if (existingPets) {
      console.log("Pets already seeded for this organization; skipping.");
      return;
    }

    console.log("Seeding pets…");
    await tx.insert(pets).values([
      {
        userId: userRow.id,
        name: "Mochi",
        type: "cat",
        breed: "Domestic Shorthair",
        weightKg: "4.20",
        gender: "female",
        vaccinated: true,
        sterilized: true,
        notes: "Shy with strangers.",
      },
      {
        userId: userRow.id,
        name: "Biscuit",
        type: "dog",
        breed: "Shiba Inu",
        weightKg: "9.50",
        gender: "male",
        vaccinated: true,
        sterilized: false,
        notes: "Loves long walks.",
      },
    ]);

    console.log("Seeding booking…");
    const start = new Date();
    const end = new Date(start.getTime() + 60 * 60 * 1000); // +1h

    const [booking] = await tx
      .insert(bookings)
      .values({
        organizationId,
        userId: userRow.id,
        staffId: staffRow.id,
        serviceType: "pet_sitting",
        startTime: start,
        endTime: end,
        status: "pending",
        totalHkd: 350,
      })
      .returning();

    if (!booking) {
      throw new Error("Seed failed: could not create booking");
    }

    console.log("Seeding booking event (creation)…");
    await tx.insert(bookingEvents).values({
      bookingId: booking.id,
      actorId: userRow.id,
      fromStatus: null,
      toStatus: "pending",
      note: "Booking created via seed script.",
    });

    console.log(
      `Seed complete. organization=${organizationId} booking=${booking.id}`,
    );
  });
}

seed()
  .then(async () => {
    await client.end();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("Seed failed:", err);
    await client.end();
    process.exit(1);
  });
