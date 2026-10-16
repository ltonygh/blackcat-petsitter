import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getOwnedPet } from "@/db/queries/pets";
import {
  checkConditionalTypeRules,
  extensionForMimeType,
  isAllowedMimeType,
  isPetDocumentType,
  MAX_UPLOAD_BYTES,
  PRESIGN_EXPIRES_IN,
  quarantinePrefix,
} from "@/lib/documents";
import { checkPresignRateLimit } from "@/lib/rate-limit";
import { generateUploadUrl } from "@/lib/r2";

/**
 * POST /api/upload/presign
 *
 * Validates an intended upload and returns a presigned PUT URL plus the
 * quarantine key the client must upload to. All uploads start in quarantine;
 * they are promoted by the confirm endpoint after validation.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: userId, organizationId } = session.user;

  // Rate limit per user: 10/hour, 50/day.
  if (!checkPresignRateLimit(userId)) {
    return NextResponse.json(
      { error: "Too many upload requests. Please try again later." },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { petId, type, mimeType, sizeBytes } = (body ?? {}) as {
    petId?: unknown;
    type?: unknown;
    mimeType?: unknown;
    sizeBytes?: unknown;
  };

  if (typeof petId !== "string" || petId.length === 0) {
    return NextResponse.json({ error: "petId is required" }, { status: 400 });
  }
  if (!isPetDocumentType(type)) {
    return NextResponse.json({ error: "Invalid document type" }, { status: 400 });
  }
  if (!isAllowedMimeType(mimeType)) {
    return NextResponse.json(
      { error: "Unsupported mime type" },
      { status: 400 },
    );
  }
  if (
    typeof sizeBytes !== "number" ||
    !Number.isInteger(sizeBytes) ||
    sizeBytes <= 0 ||
    sizeBytes > MAX_UPLOAD_BYTES
  ) {
    return NextResponse.json(
      { error: "sizeBytes must be between 1 and 5242880" },
      { status: 400 },
    );
  }

  // Verify the pet exists, is in this tenant, and is owned by this user.
  const pet = await getOwnedPet(organizationId, userId, petId);
  if (!pet) {
    return NextResponse.json({ error: "Pet not found" }, { status: 404 });
  }

  // Conditional type rules (weight_proof -> dogs only; vaccination ->
  // vaccinated pets only).
  const ruleError = checkConditionalTypeRules(type, pet);
  if (ruleError) {
    return NextResponse.json({ error: ruleError }, { status: 400 });
  }

  const ext = extensionForMimeType(mimeType);
  const key = `${quarantinePrefix(petId, type)}${randomUUID()}.${ext}`;

  const uploadUrl = await generateUploadUrl(
    key,
    mimeType,
    sizeBytes,
    PRESIGN_EXPIRES_IN,
  );

  return NextResponse.json({
    uploadUrl,
    r2Key: key,
    expiresIn: PRESIGN_EXPIRES_IN,
  });
}
