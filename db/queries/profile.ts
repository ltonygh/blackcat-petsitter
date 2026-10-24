import { and, eq } from "drizzle-orm";

import { withTenant, type TenantTransaction } from "../client";
import { addresses, pets, users } from "../schema";

/**
 * Extended ("detailed") profile data for a user's addresses and pets.
 *
 * This is the operational info collected AFTER a booking (estate access,
 * feeding/cleaning locations, vets, pet habits, etc.) so the initial booking
 * form stays lean.
 *
 * TENANCY: `addresses` and `pets` have NO RLS. Isolation is inherited via
 * `user_id -> users.organization_id` (users IS RLS-protected). Every function
 * here runs inside `withTenant(organizationId, ...)` and additionally joins
 * `users` + filters `organizationId` before any read or write, so cross-tenant
 * rows are never touched.
 */

const DETAILED_TEXT_FIELDS = [
  "estatePassword",
  "keycardInfo",
  "foodAmount",
  "foodLocation",
  "waterLocation",
  "toolsLocation",
  "toysLocation",
  "trashLocation",
  "emergencyContact",
  "primaryVet",
  "backupVet",
  "otherNotes",
] as const;

export type DetailedAddressField = (typeof DETAILED_TEXT_FIELDS)[number];

/** Address subset returned by the detailed profile endpoint. */
export type DetailedAddress = {
  id: string;
} & Record<DetailedAddressField, string | null>;

/** Pet subset returned by the detailed profile endpoint. */
export type DetailedPet = {
  id: string;
  name: string;
  type: string;
  age: number | null;
  gender: string | null;
  habits: string | null;
};

export type DetailedProfile = {
  address: DetailedAddress | null;
  pets: DetailedPet[];
};

/** Input accepted by updateProfileDetail — all fields optional (partial). */
export type UpdateDetailedProfileInput = {
  /** Target a specific address; defaults to the user's most recent address. */
  addressId?: string;
  /** Target a specific pet (required to update pet detail fields). */
  petId?: string;
  address?: Partial<Record<DetailedAddressField, string | null>>;
  pet?: {
    age?: number | null;
    gender?: string | null;
    habits?: string | null;
  };
};

/** Select projection for the detailed address columns. */
const addressDetailColumns = {
  id: addresses.id,
  estatePassword: addresses.estatePassword,
  keycardInfo: addresses.keycardInfo,
  foodAmount: addresses.foodAmount,
  foodLocation: addresses.foodLocation,
  waterLocation: addresses.waterLocation,
  toolsLocation: addresses.toolsLocation,
  toysLocation: addresses.toysLocation,
  trashLocation: addresses.trashLocation,
  emergencyContact: addresses.emergencyContact,
  primaryVet: addresses.primaryVet,
  backupVet: addresses.backupVet,
  otherNotes: addresses.otherNotes,
};

/**
 * Resolve an address owned by `userId` in this tenant. If `addressId` is
 * given, that exact row (must belong to user); otherwise the user's most
 * recently created address.
 */
async function resolveAddress(
  tx: TenantTransaction,
  organizationId: string,
  userId: string,
  addressId?: string,
) {
  const where = addressId
    ? and(eq(addresses.id, addressId), eq(addresses.userId, userId))
    : eq(addresses.userId, userId);

  // `addresses` has no RLS; the userId filter + withTenant scoping is what
  // keeps this safe. We additionally verify the user is in this org below.
  const [row] = await tx
    .select({ id: addresses.id })
    .from(addresses)
    .innerJoin(users, eq(addresses.userId, users.id))
    .where(and(where, eq(users.organizationId, organizationId)))
    .orderBy(addresses.createdAt)
    .limit(1);
  return row ?? null;
}

/**
 * Resolve a pet owned by `userId` in this tenant.
 */
async function resolvePet(
  tx: TenantTransaction,
  organizationId: string,
  userId: string,
  petId: string,
) {
  const [row] = await tx
    .select({ id: pets.id })
    .from(pets)
    .innerJoin(users, eq(pets.userId, users.id))
    .where(
      and(
        eq(pets.id, petId),
        eq(pets.userId, userId),
        eq(users.organizationId, organizationId),
      ),
    )
    .limit(1);
  return row ?? null;
}

/**
 * Fetch the user's detailed profile: their (default) address's operational
 * fields plus all of their pets' age/gender/habits.
 */
export async function getUserProfileDetail(
  organizationId: string,
  userId: string,
): Promise<DetailedProfile> {
  return withTenant(organizationId, async (tx) => {
    // Addresses owned by the user (tenant-scoped via join).
    const addressRows = await tx
      .select(addressDetailColumns)
      .from(addresses)
      .innerJoin(users, eq(addresses.userId, users.id))
      .where(
        and(
          eq(addresses.userId, userId),
          eq(users.organizationId, organizationId),
        ),
      )
      .orderBy(addresses.createdAt)
      .limit(1);

    // Pets owned by the user (tenant-scoped via join).
    const petRows = await tx
      .select({
        id: pets.id,
        name: pets.name,
        type: pets.type,
        age: pets.age,
        gender: pets.gender,
        habits: pets.habits,
      })
      .from(pets)
      .innerJoin(users, eq(pets.userId, users.id))
      .where(
        and(eq(pets.userId, userId), eq(users.organizationId, organizationId)),
      )
      .orderBy(pets.createdAt);

    return {
      address: (addressRows[0] as DetailedAddress | undefined) ?? null,
      pets: petRows as DetailedPet[],
    };
  });
}

/**
 * Update detailed address and/or pet fields for a user.
 *
 * - `input.address` updates the target address (input.addressId, else the
 *   user's most recent address).
 * - `input.pet` requires `input.petId` and updates that pet.
 *
 * Returns the refreshed detailed profile. Throws a domain error (code P0001)
 * if the requested address/pet does not belong to the user in this tenant.
 */
export async function updateProfileDetail(
  organizationId: string,
  userId: string,
  input: UpdateDetailedProfileInput,
): Promise<DetailedProfile> {
  return withTenant(organizationId, async (tx) => {
    // --- Address update -----------------------------------------------------
    if (input.address && Object.keys(input.address).length > 0) {
      const target = await resolveAddress(
        tx,
        organizationId,
        userId,
        input.addressId,
      );
      if (!target) {
        const err = new Error("Address not found for this user") as Error & {
          code?: string;
        };
        err.code = "P0001";
        throw err;
      }

      const set: Record<string, string | null> = {};
      for (const field of DETAILED_TEXT_FIELDS) {
        if (input.address[field] !== undefined) {
          set[field] = input.address[field] as string | null;
        }
      }
      if (Object.keys(set).length > 0) {
        // Scoped by the resolved address id (already proven tenant-owned).
        await tx
          .update(addresses)
          .set(set)
          .where(eq(addresses.id, target.id));
      }
    }

    // --- Pet update ---------------------------------------------------------
    if (input.pet && Object.keys(input.pet).length > 0) {
      if (!input.petId) {
        const err = new Error("petId is required to update pet details") as Error & {
          code?: string;
        };
        err.code = "P0002";
        throw err;
      }
      const target = await resolvePet(tx, organizationId, userId, input.petId);
      if (!target) {
        const err = new Error("Pet not found for this user") as Error & {
          code?: string;
        };
        err.code = "P0001";
        throw err;
      }

      await tx
        .update(pets)
        .set({
          ...(input.pet.age !== undefined ? { age: input.pet.age } : {}),
          ...(input.pet.gender !== undefined
            ? { gender: input.pet.gender }
            : {}),
          ...(input.pet.habits !== undefined ? { habits: input.pet.habits } : {}),
        })
        .where(eq(pets.id, target.id));
    }

    // --- Return refreshed detail (reuse the tx) -----------------------------
    const addressRows = await tx
      .select(addressDetailColumns)
      .from(addresses)
      .innerJoin(users, eq(addresses.userId, users.id))
      .where(
        and(
          eq(addresses.userId, userId),
          eq(users.organizationId, organizationId),
        ),
      )
      .orderBy(addresses.createdAt)
      .limit(1);

    const petRows = await tx
      .select({
        id: pets.id,
        name: pets.name,
        type: pets.type,
        age: pets.age,
        gender: pets.gender,
        habits: pets.habits,
      })
      .from(pets)
      .innerJoin(users, eq(pets.userId, users.id))
      .where(
        and(eq(pets.userId, userId), eq(users.organizationId, organizationId)),
      )
      .orderBy(pets.createdAt);

    return {
      address: (addressRows[0] as DetailedAddress | undefined) ?? null,
      pets: petRows as DetailedPet[],
    };
  });
}
