import { NextResponse } from "next/server";

import { auth } from "@/auth";
import {
  getOwnedPet,
  insertPetDocument,
  setPetIconKey,
  softDeleteActiveIcon,
} from "@/db/queries/pets";
import {
  extensionForMimeType,
  isAllowedMimeType,
  isPetDocumentType,
  isQuarantineKeyForPet,
  sizeWithinTolerance,
} from "@/lib/documents";
import { reencodeImage, validateMagicBytes } from "@/lib/image";
import {
  deleteObject,
  getObjectRange,
  headObject,
  moveObject,
  publicUrl,
  putObject,
} from "@/lib/r2";

/**
 * POST /api/upload/confirm
 *
 * Finalises a direct-to-R2 upload:
 *   1. Confirms the object is under quarantine/{petId}/{type}/ (key injection).
 *   2. Confirms the object exists and its size matches within ±5%.
 *   3. Validates magic bytes (real file type, not the declared one).
 *   4. Re-encodes images through sharp (strips EXIF/scripts/polyglots).
 *   5. Promotes quarantine -> pets/{petId}/{type}/{uuid}.{ext}.
 *   6. Persists a pet_documents row (soft-deleting any prior active icon).
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: userId, organizationId } = session.user;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    petId,
    r2Key,
    type,
    mimeType,
    sizeBytes,
    originalFilename,
    notes,
  } = (body ?? {}) as {
    petId?: unknown;
    r2Key?: unknown;
    type?: unknown;
    mimeType?: unknown;
    sizeBytes?: unknown;
    originalFilename?: unknown;
    notes?: unknown;
  };

  if (typeof petId !== "string" || petId.length === 0) {
    return NextResponse.json({ error: "petId is required" }, { status: 400 });
  }
  if (!isPetDocumentType(type)) {
    return NextResponse.json({ error: "Invalid document type" }, { status: 400 });
  }
  if (!isAllowedMimeType(mimeType)) {
    return NextResponse.json({ error: "Unsupported mime type" }, { status: 400 });
  }
  if (typeof r2Key !== "string" || r2Key.length === 0) {
    return NextResponse.json({ error: "r2Key is required" }, { status: 400 });
  }
  if (typeof sizeBytes !== "number" || sizeBytes <= 0) {
    return NextResponse.json({ error: "sizeBytes is required" }, { status: 400 });
  }

  // 1. Key must be under this pet's quarantine prefix (prevents injection).
  if (!isQuarantineKeyForPet(r2Key, petId, type)) {
    return NextResponse.json(
      { error: "r2Key must be under the quarantine prefix for this pet/type" },
      { status: 400 },
    );
  }

  // Authorise: pet must belong to this user in this tenant.
  const pet = await getOwnedPet(organizationId, userId, petId);
  if (!pet) {
    return NextResponse.json({ error: "Pet not found" }, { status: 404 });
  }

  // 2. Object must exist and size must match within tolerance.
  const head = await headObject(r2Key);
  if (!head) {
    return NextResponse.json(
      { error: "Uploaded object not found in storage" },
      { status: 400 },
    );
  }
  if (!sizeWithinTolerance(sizeBytes, head.size)) {
    return NextResponse.json(
      { error: "Uploaded object size does not match declared size" },
      { status: 400 },
    );
  }

  // 3. Magic-byte validation using the first 8 bytes.
  const prefix = await getObjectRange(r2Key, 8);
  if (!validateMagicBytes(mimeType, prefix)) {
    await deleteObject(r2Key).catch(() => undefined);
    return NextResponse.json(
      { error: "File content does not match its declared type" },
      { status: 400 },
    );
  }

  const ext = extensionForMimeType(mimeType);
  // Reuse the quarantine filename's basename for the promoted key so the
  // promoted object keeps a unique, server-generated name.
  const basename = r2Key.split("/").pop() ?? `${crypto.randomUUID()}.${ext}`;

  let finalSize = sizeBytes;

  // 4. Re-encode images (skip PDFs). Overwrite the same key with the
  //    sanitised bytes so the promoted object is what we validated.
  if (mimeType === "image/jpeg" || mimeType === "image/png") {
    const bytes = await getObjectRange(r2Key, head.size);
    const { data, size } = await reencodeImage(Buffer.from(bytes), mimeType);

    // Overwrite the quarantine key with the re-encoded image.
    await putObject(r2Key, data, mimeType);
    finalSize = size;
  }

  // 5. Promote from quarantine to the public prefix.
  const finalKey = `pets/${petId}/${type}/${basename}`;
  await moveObject(r2Key, finalKey);

  // 6. Icon uniqueness: deactivate any existing active icon first.
  if (type === "pet_icon") {
    await softDeleteActiveIcon(organizationId, petId);
  }

  // 7. Persist the document row.
  let created;
  try {
    created = await insertPetDocument(organizationId, {
      petId,
      type,
      r2Key: finalKey,
      originalFilename:
        typeof originalFilename === "string" ? originalFilename : null,
      mimeType,
      sizeBytes: finalSize,
      uploadedBy: userId,
      notes: typeof notes === "string" ? notes : null,
    });
  } catch (err) {
    // Surface a clean 500 for the r2_key unique violation instead of leaking
    // a raw Postgres error.
    const code = (err as { code?: string })?.code;
    if (code === "23505") {
      return NextResponse.json(
        { error: "A document with this storage key already exists" },
        { status: 500 },
      );
    }
    throw err;
  }

  // If this was a pet icon, point the pet at the new key.
  if (type === "pet_icon") {
    await setPetIconKey(organizationId, petId, finalKey);
  }

  return NextResponse.json({
    id: created.id,
    petId: created.petId,
    type: created.type,
    originalFilename: created.originalFilename,
    mimeType: created.mimeType,
    sizeBytes: created.sizeBytes,
    uploadedAt: created.uploadedAt,
    notes: created.notes,
    url: publicUrl(finalKey),
  });
}
