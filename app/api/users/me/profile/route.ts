import { NextResponse } from "next/server";

import { auth } from "@/auth";
import {
  getUserProfileDetail,
  updateProfileDetail,
  type DetailedAddressField,
  type UpdateDetailedProfileInput,
} from "@/db/queries/profile";

/**
 * Detailed ("operational") profile fields — collected after booking so the
 * initial form stays lean.
 */

const ADDRESS_FIELDS: DetailedAddressField[] = [
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
];

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

/**
 * GET /api/users/me/profile
 *
 * Returns the caller's detailed profile:
 *   { addresses: [{ id, estatePassword, keycardInfo, foodAmount, ... }],
 *     address: <first address | null>  // back-compat
 *     pets: [{ id, name, type, age, gender, habits }] }
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: userId, organizationId } = session.user;
  const profile = await getUserProfileDetail(organizationId, userId);
  return NextResponse.json({ profile });
}

/**
 * PATCH /api/users/me/profile
 *
 * Accepts partial detailed address + pet updates:
 * {
 *   "addressId"?: string,            // optional; defaults to most recent address
 *   "address"?: { estatePassword?, keycardInfo?, foodAmount?, foodLocation?,
 *                 waterLocation?, toolsLocation?, toysLocation?, trashLocation?,
 *                 emergencyContact?, primaryVet?, backupVet?, otherNotes? },
 *   "petId"?: string,                // required when updating pet
 *   "pet"?: { age?, gender?, habits? }
 * }
 *
 * Returns the updated { profile }.
 */
export async function PATCH(request: Request) {
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

  const root = asRecord(body);
  if (!root) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { addressId, petId, address, pet } = root;

  if (addressId !== undefined && typeof addressId !== "string") {
    return NextResponse.json(
      { error: "addressId must be a string" },
      { status: 400 },
    );
  }
  if (petId !== undefined && typeof petId !== "string") {
    return NextResponse.json(
      { error: "petId must be a string" },
      { status: 400 },
    );
  }

  const input: UpdateDetailedProfileInput = {};
  if (typeof addressId === "string") input.addressId = addressId;
  if (typeof petId === "string") input.petId = petId;

  // --- address block --------------------------------------------------------
  if (address !== undefined) {
    const addr = asRecord(address);
    if (!addr) {
      return NextResponse.json(
        { error: "address must be an object" },
        { status: 400 },
      );
    }
    const addrPatch: Partial<Record<DetailedAddressField, string | null>> = {};
    for (const field of ADDRESS_FIELDS) {
      const v = addr[field];
      if (v === undefined) continue;
      if (v !== null && typeof v !== "string") {
        return NextResponse.json(
          { error: `address.${field} must be a string or null` },
          { status: 400 },
        );
      }
      addrPatch[field] = v as string | null;
    }
    if (Object.keys(addrPatch).length > 0) input.address = addrPatch;
  }

  // --- pet block ------------------------------------------------------------
  if (pet !== undefined) {
    const p = asRecord(pet);
    if (!p) {
      return NextResponse.json(
        { error: "pet must be an object" },
        { status: 400 },
      );
    }
    if (typeof petId !== "string") {
      return NextResponse.json(
        { error: "petId is required when updating pet details" },
        { status: 400 },
      );
    }
    const petPatch: NonNullable<UpdateDetailedProfileInput["pet"]> = {};
    if (p.age !== undefined) {
      if (p.age !== null && (typeof p.age !== "number" || !Number.isInteger(p.age))) {
        return NextResponse.json(
          { error: "pet.age must be an integer or null" },
          { status: 400 },
        );
      }
      petPatch.age = p.age as number | null;
    }
    if (p.gender !== undefined) {
      if (p.gender !== null && typeof p.gender !== "string") {
        return NextResponse.json(
          { error: "pet.gender must be a string or null" },
          { status: 400 },
        );
      }
      petPatch.gender = p.gender as string | null;
    }
    if (p.habits !== undefined) {
      if (p.habits !== null && typeof p.habits !== "string") {
        return NextResponse.json(
          { error: "pet.habits must be a string or null" },
          { status: 400 },
        );
      }
      petPatch.habits = p.habits as string | null;
    }
    if (Object.keys(petPatch).length > 0) input.pet = petPatch;
  }

  if (!input.address && !input.pet) {
    return NextResponse.json(
      { error: "No updatable fields provided (address, pet)" },
      { status: 400 },
    );
  }

  try {
    const profile = await updateProfileDetail(organizationId, userId, input);
    return NextResponse.json({ profile });
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === "P0001") {
      return NextResponse.json(
        { error: "Address or pet not found for this user" },
        { status: 404 },
      );
    }
    if (code === "P0002") {
      return NextResponse.json(
        { error: "petId is required to update pet details" },
        { status: 400 },
      );
    }
    throw err;
  }
}
