import { and, eq, isNull } from "drizzle-orm";

import { withTenant } from "../client";
import { petDocuments, pets, users } from "../schema";

/**
 * Tenant-scoped pet + document queries.
 *
 * IMPORTANT — how tenancy is actually enforced here:
 * `pets` and `pet_documents` do NOT have RLS (by design). Their isolation is
 * inherited through the FK chain `pets.user_id -> users.organization_id`, and
 * `users` IS RLS-protected (FORCE). To make that inheritance bite, EVERY query
 * below JOINS `pets` (or resolves its owner) to `users` and additionally
 * filters on `users.organizationId`. A bare `SELECT ... FROM pets WHERE id=$1`
 * under a tenant GUC would NOT be scoped, because no policy reads the GUC for
 * `pets`. All functions here run inside withTenant(organizationId, ...).
 *
 * For pet_documents we likewise constrain by joining to `pets` -> `users` and
 * matching the organization, so cross-tenant rows are never returned.
 */

export type PetRow = {
  id: string;
  userId: string;
  name: string;
  type: string;
  vaccinated: boolean | null;
  iconKey: string | null;
};

/**
 * Fetch a pet by id within an organization, but ONLY if it belongs to the
 * given user. The `users` join + organizationId filter is what enforces
 * tenancy (pets has no RLS of its own).
 */
export async function getOwnedPet(
  organizationId: string,
  userId: string,
  petId: string,
): Promise<PetRow | null> {
  return withTenant(organizationId, async (tx) => {
    const [row] = await tx
      .select({
        id: pets.id,
        userId: pets.userId,
        name: pets.name,
        type: pets.type,
        vaccinated: pets.vaccinated,
        iconKey: pets.iconKey,
      })
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
  });
}

/**
 * Fetch a pet by id within an organization (any owner in the tenant). The
 * `users` join + organizationId filter enforces tenancy.
 */
export async function getPetInTenant(
  organizationId: string,
  petId: string,
): Promise<PetRow | null> {
  return withTenant(organizationId, async (tx) => {
    const [row] = await tx
      .select({
        id: pets.id,
        userId: pets.userId,
        name: pets.name,
        type: pets.type,
        vaccinated: pets.vaccinated,
        iconKey: pets.iconKey,
      })
      .from(pets)
      .innerJoin(users, eq(pets.userId, users.id))
      .where(
        and(eq(pets.id, petId), eq(users.organizationId, organizationId)),
      )
      .limit(1);
    return row ?? null;
  });
}

export type PetDocumentRow = {
  id: string;
  petId: string;
  type: string;
  r2Key: string;
  originalFilename: string | null;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: string;
  uploadedAt: Date;
  deletedAt: Date | null;
  notes: string | null;
};

function toDocRow(row: {
  id: string;
  petId: string;
  type: string;
  r2Key: string;
  originalFilename: string | null;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: string;
  uploadedAt: Date;
  deletedAt: Date | null;
  notes: string | null;
}): PetDocumentRow {
  return {
    id: row.id,
    petId: row.petId,
    type: row.type,
    r2Key: row.r2Key,
    originalFilename: row.originalFilename,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    uploadedBy: row.uploadedBy,
    uploadedAt: row.uploadedAt,
    deletedAt: row.deletedAt,
    notes: row.notes,
  };
}

/**
 * List all non-deleted documents for a pet within an organization.
 * Tenancy enforced by joining pet_documents -> pets -> users and filtering on
 * users.organizationId (pet_documents itself has no RLS).
 */
export async function listPetDocuments(
  organizationId: string,
  petId: string,
): Promise<PetDocumentRow[]> {
  return withTenant(organizationId, async (tx) => {
    const rows = await tx
      .select({
        id: petDocuments.id,
        petId: petDocuments.petId,
        type: petDocuments.type,
        r2Key: petDocuments.r2Key,
        originalFilename: petDocuments.originalFilename,
        mimeType: petDocuments.mimeType,
        sizeBytes: petDocuments.sizeBytes,
        uploadedBy: petDocuments.uploadedBy,
        uploadedAt: petDocuments.uploadedAt,
        deletedAt: petDocuments.deletedAt,
        notes: petDocuments.notes,
      })
      .from(petDocuments)
      .innerJoin(pets, eq(petDocuments.petId, pets.id))
      .innerJoin(users, eq(pets.userId, users.id))
      .where(
        and(
          eq(petDocuments.petId, petId),
          isNull(petDocuments.deletedAt),
          eq(users.organizationId, organizationId),
        ),
      );
    return rows.map(toDocRow);
  });
}

/**
 * Fetch a single non-deleted document by id within an organization (tenancy
 * enforced via the pets -> users join).
 */
export async function getDocument(
  organizationId: string,
  documentId: string,
): Promise<PetDocumentRow | null> {
  return withTenant(organizationId, async (tx) => {
    const [row] = await tx
      .select({
        id: petDocuments.id,
        petId: petDocuments.petId,
        type: petDocuments.type,
        r2Key: petDocuments.r2Key,
        originalFilename: petDocuments.originalFilename,
        mimeType: petDocuments.mimeType,
        sizeBytes: petDocuments.sizeBytes,
        uploadedBy: petDocuments.uploadedBy,
        uploadedAt: petDocuments.uploadedAt,
        deletedAt: petDocuments.deletedAt,
        notes: petDocuments.notes,
      })
      .from(petDocuments)
      .innerJoin(pets, eq(petDocuments.petId, pets.id))
      .innerJoin(users, eq(pets.userId, users.id))
      .where(
        and(
          eq(petDocuments.id, documentId),
          isNull(petDocuments.deletedAt),
          eq(users.organizationId, organizationId),
        ),
      )
      .limit(1);
    return row ? toDocRow(row) : null;
  });
}

export type InsertDocumentInput = {
  petId: string;
  type: string;
  r2Key: string;
  originalFilename: string | null;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: string;
  notes: string | null;
};

/**
 * Insert a pet_documents row within an organization.
 *
 * GUARD: before inserting, assert the pet belongs to this organization (via
 * the pets -> users join). pet_documents has no RLS, so without this check a
 * caller could attach a document to another tenant's pet. Throws if the pet is
 * not in the tenant.
 */
export async function insertPetDocument(
  organizationId: string,
  input: InsertDocumentInput,
): Promise<PetDocumentRow> {
  return withTenant(organizationId, async (tx) => {
    const [owned] = await tx
      .select({ id: pets.id })
      .from(pets)
      .innerJoin(users, eq(pets.userId, users.id))
      .where(
        and(
          eq(pets.id, input.petId),
          eq(users.organizationId, organizationId),
        ),
      )
      .limit(1);

    if (!owned) {
      const err = new Error("Pet not found in this organization") as Error & {
        code?: string;
      };
      err.code = "P0001"; // surface as a domain error, not a raw FK error
      throw err;
    }

    const [row] = await tx
      .insert(petDocuments)
      .values({
        petId: input.petId,
        type: input.type,
        r2Key: input.r2Key,
        originalFilename: input.originalFilename,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        uploadedBy: input.uploadedBy,
        notes: input.notes,
      })
      .returning();
    return toDocRow(row);
  });
}

/**
 * Soft-delete a document (set deleted_at = NOW()) within an organization.
 * Only affects the row if its pet belongs to the tenant. Returns true if a
 * live row was affected.
 */
export async function softDeleteDocument(
  organizationId: string,
  documentId: string,
): Promise<boolean> {
  return withTenant(organizationId, async (tx) => {
    const [owned] = await tx
      .select({ id: petDocuments.id })
      .from(petDocuments)
      .innerJoin(pets, eq(petDocuments.petId, pets.id))
      .innerJoin(users, eq(pets.userId, users.id))
      .where(
        and(
          eq(petDocuments.id, documentId),
          isNull(petDocuments.deletedAt),
          eq(users.organizationId, organizationId),
        ),
      )
      .limit(1);

    if (!owned) return false;

    await tx
      .update(petDocuments)
      .set({ deletedAt: new Date() })
      .where(eq(petDocuments.id, documentId));
    return true;
  });
}

/**
 * Soft-delete the current active pet_icon for a pet (if any), scoped to the
 * organization. Returns the r2Key of the document that was deactivated, or
 * null if there was none.
 */
export async function softDeleteActiveIcon(
  organizationId: string,
  petId: string,
): Promise<string | null> {
  return withTenant(organizationId, async (tx) => {
    // Confirm the pet is in this tenant first (pets has no RLS).
    const [owned] = await tx
      .select({ id: pets.id })
      .from(pets)
      .innerJoin(users, eq(pets.userId, users.id))
      .where(
        and(eq(pets.id, petId), eq(users.organizationId, organizationId)),
      )
      .limit(1);
    if (!owned) return null;

    const rows = await tx
      .update(petDocuments)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(petDocuments.petId, petId),
          eq(petDocuments.type, "pet_icon"),
          isNull(petDocuments.deletedAt),
        ),
      )
      .returning({ r2Key: petDocuments.r2Key });
    return rows[0]?.r2Key ?? null;
  });
}

/**
 * Update the pet's icon_key within an organization. Uses a subselect guarded
 * by the owning user's organization so a cross-tenant pet id is a no-op.
 */
export async function setPetIconKey(
  organizationId: string,
  petId: string,
  iconKey: string,
): Promise<void> {
  await withTenant(organizationId, async (tx) => {
    const [owned] = await tx
      .select({ id: pets.id })
      .from(pets)
      .innerJoin(users, eq(pets.userId, users.id))
      .where(
        and(eq(pets.id, petId), eq(users.organizationId, organizationId)),
      )
      .limit(1);
    if (!owned) return;

    await tx.update(pets).set({ iconKey }).where(eq(pets.id, petId));
  });
}
