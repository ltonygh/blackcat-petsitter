import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { createPet, listPetsByUser } from "@/db/queries/pets";

/**
 * GET /api/pets
 *
 * Returns all pets owned by the current user (within the caller's tenant).
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: userId, organizationId } = session.user;
  const pets = await listPetsByUser(organizationId, userId);
  return NextResponse.json({ pets });
}

/**
 * POST /api/pets
 *
 * Creates a pet owned by the current user. Accepts
 * { name, type, breed, weightKg, vaccinated, sterilized, notes } and returns
 * the created Pet object (including id).
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

  const { name, type, breed, weightKg, vaccinated, sterilized, notes } =
    (body ?? {}) as {
      name?: unknown;
      type?: unknown;
      breed?: unknown;
      weightKg?: unknown;
      vaccinated?: unknown;
      sterilized?: unknown;
      notes?: unknown;
    };

  if (typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (typeof type !== "string" || type.trim().length === 0) {
    return NextResponse.json({ error: "type is required" }, { status: 400 });
  }
  if (breed !== undefined && breed !== null && typeof breed !== "string") {
    return NextResponse.json({ error: "breed must be a string" }, { status: 400 });
  }
  if (
    weightKg !== undefined &&
    weightKg !== null &&
    typeof weightKg !== "number" &&
    typeof weightKg !== "string"
  ) {
    return NextResponse.json(
      { error: "weightKg must be a number" },
      { status: 400 },
    );
  }
  if (
    vaccinated !== undefined &&
    vaccinated !== null &&
    typeof vaccinated !== "boolean"
  ) {
    return NextResponse.json(
      { error: "vaccinated must be a boolean" },
      { status: 400 },
    );
  }
  if (
    sterilized !== undefined &&
    sterilized !== null &&
    typeof sterilized !== "boolean"
  ) {
    return NextResponse.json(
      { error: "sterilized must be a boolean" },
      { status: 400 },
    );
  }
  if (notes !== undefined && notes !== null && typeof notes !== "string") {
    return NextResponse.json({ error: "notes must be a string" }, { status: 400 });
  }

  try {
    const pet = await createPet(organizationId, userId, {
      name: name.trim(),
      type: type.trim(),
      breed: typeof breed === "string" ? breed : null,
      weightKg:
        weightKg === undefined || weightKg === null
          ? null
          : (weightKg as string | number),
      vaccinated: typeof vaccinated === "boolean" ? vaccinated : null,
      sterilized: typeof sterilized === "boolean" ? sterilized : null,
      notes: typeof notes === "string" ? notes : null,
    });

    return NextResponse.json({ pet }, { status: 201 });
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === "P0001") {
      return NextResponse.json({ error: "Pet could not be created" }, { status: 403 });
    }
    throw err;
  }
}
