import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getPetInTenant, listPetDocuments } from "@/db/queries/pets";
import { publicUrl } from "@/lib/r2";

/**
 * GET /api/pets/[petId]/documents
 *
 * Lists all non-deleted documents for a pet within the caller's tenant.
 * Returns 404 (not 403) when the pet is not visible in this tenant, so the
 * endpoint does not leak the existence of other tenants' pets.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ petId: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { organizationId } = session.user;
  const { petId } = await params;

  // Confirm the pet exists in this tenant; otherwise 404 (no existence leak).
  const pet = await getPetInTenant(organizationId, petId);
  if (!pet) {
    return NextResponse.json({ error: "Pet not found" }, { status: 404 });
  }

  const documents = await listPetDocuments(organizationId, petId);

  return NextResponse.json({
    petId,
    documents: documents.map((d) => ({
      id: d.id,
      petId: d.petId,
      type: d.type,
      originalFilename: d.originalFilename,
      mimeType: d.mimeType,
      sizeBytes: d.sizeBytes,
      uploadedAt: d.uploadedAt,
      notes: d.notes,
      // Only the promoted public key is ever exposed here.
      url: publicUrl(d.r2Key),
    })),
  });
}
