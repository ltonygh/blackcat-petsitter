import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { createAddress, listAddressesByUser } from "@/db/queries/addresses";

/**
 * GET /api/addresses
 *
 * Returns all addresses belonging to the current user (within the caller's
 * tenant). Backs the "Address Book" dropdown in the booking wizard.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: userId, organizationId } = session.user;
  const addresses = await listAddressesByUser(organizationId, userId);
  return NextResponse.json({ addresses });
}

/**
 * POST /api/addresses
 *
 * Creates an address owned by the current user. Accepts
 * { label?, fullAddress } and returns the created Address object (incl. id).
 * Transport/MTR fields are left null for the owner to complete during quote
 * review.
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

  const { label, fullAddress } = (body ?? {}) as {
    label?: unknown;
    fullAddress?: unknown;
  };

  if (typeof fullAddress !== "string" || fullAddress.trim().length === 0) {
    return NextResponse.json(
      { error: "fullAddress is required" },
      { status: 400 },
    );
  }
  if (label !== undefined && label !== null && typeof label !== "string") {
    return NextResponse.json({ error: "label must be a string" }, { status: 400 });
  }

  try {
    const address = await createAddress(organizationId, userId, {
      label: typeof label === "string" ? label : null,
      fullAddress: fullAddress.trim(),
    });
    return NextResponse.json({ address }, { status: 201 });
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === "P0001") {
      return NextResponse.json(
        { error: "Address could not be created" },
        { status: 403 },
      );
    }
    throw err;
  }
}
