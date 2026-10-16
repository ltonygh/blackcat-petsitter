/**
 * Pet document domain constants and validation helpers.
 *
 * Shared by the presign / confirm / list / delete API routes so the rules live
 * in exactly one place.
 */

export const PET_DOCUMENT_TYPES = [
  "vaccination",
  "weight_proof",
  "pet_icon",
  "medical",
  "other",
] as const;

export type PetDocumentType = (typeof PET_DOCUMENT_TYPES)[number];

export const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "application/pdf",
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

/** 5 MB maximum upload size. */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5_242_880

/** Presigned URL lifetime (seconds). */
export const PRESIGN_EXPIRES_IN = 300;

/** Maximum longest-side dimension for re-encoded images. */
export const IMAGE_MAX_DIMENSION = 1920;

export function isPetDocumentType(value: unknown): value is PetDocumentType {
  return (
    typeof value === "string" &&
    (PET_DOCUMENT_TYPES as readonly string[]).includes(value)
  );
}

export function isAllowedMimeType(value: unknown): value is AllowedMimeType {
  return (
    typeof value === "string" &&
    (ALLOWED_MIME_TYPES as readonly string[]).includes(value)
  );
}

/** File extension for a given allowed mime type. */
export function extensionForMimeType(mimeType: AllowedMimeType): string {
  switch (mimeType) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "application/pdf":
      return "pdf";
  }
}

/** The quarantine key prefix every upload must live under before promotion. */
export function quarantinePrefix(
  petId: string,
  type: PetDocumentType,
): string {
  return `quarantine/${petId}/${type}/`;
}

export function isQuarantineKeyForPet(
  key: string,
  petId: string,
  type: string,
): boolean {
  return key.startsWith(`quarantine/${petId}/${type}/`);
}

/**
 * Size tolerance (±5%) when comparing the declared size against the object
 * actually stored in R2.
 */
export function sizeWithinTolerance(
  declared: number,
  actual: number,
  tolerance = 0.05,
): boolean {
  if (declared <= 0) return false;
  const delta = Math.abs(actual - declared);
  return delta <= declared * tolerance;
}

/**
 * Conditional per-type upload rules. Pure function so it can be unit-tested
 * and reused by the presign route without duplicating logic.
 *
 * Returns an error message string when the request is NOT allowed, or null
 * when it is allowed.
 */
export function checkConditionalTypeRules(
  type: PetDocumentType,
  pet: { type: string; vaccinated: boolean | null },
): string | null {
  if (type === "weight_proof" && pet.type !== "dog") {
    return "weight_proof is only allowed for dogs";
  }
  if (type === "vaccination" && pet.vaccinated !== true) {
    return "vaccination documents require a vaccinated pet";
  }
  return null;
}
