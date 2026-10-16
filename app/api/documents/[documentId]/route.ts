import { NextResponse } from "next/server";

import { auth } from "@/auth";
import {
  getDocument,
  getPetInTenant,
  setPetIconKey,
  softDeleteDocument,
} from "@/db/queries/pets";
import { defaultIconKey } from "@/lib/pet-icons";

/**
 * DELETE /api/documents/[documentId]
 *
 * Soft-deletes a document (sets deleted_at = NOW()). The R2 object is NOT
 * removed here — a separate scheduled task cleans up storage. If the deleted
 * document was the pet's active icon, the pet's icon_key is reset to the
 * stock default for its type.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { organizationId } = session.user;
  const { documentId } = await params;

  const doc = await getDocument(organizationId, documentId);
  if (!doc) {
    // Not visible in this tenant -> 404 (do not leak existence).
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const deleted = await softDeleteDocument(organizationId, documentId);
  if (!deleted) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  // If it was a pet icon, reset the pet to its stock default.
  if (doc.type === "pet_icon") {
    const pet = await getPetInTenant(organizationId, doc.petId);
    if (pet) {
      await setPetIconKey(organizationId, pet.id, defaultIconKey(pet.type));
    }
  }

  return NextResponse.json({ id: documentId, deleted: true });
}
