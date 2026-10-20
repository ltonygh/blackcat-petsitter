import { NextResponse } from "next/server";

import { auth } from "@/auth";
import {
  createBooking,
  listBookings,
  type BookingStatus,
} from "@/db/queries/bookings";

/**
 * GET /api/bookings
 *
 * Role-scoped listing with the enriched BookingWithDetails shape:
 *   - user  -> bookings where userId = caller
 *   - staff -> bookings where staffId = caller
 *   - owner -> all bookings in the organization
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: userId, organizationId, role } = session.user;
  const bookings = await listBookings(organizationId, userId, role);
  return NextResponse.json({ bookings });
}

/**
 * POST /api/bookings
 *
 * Accepts { petId, addressId, serviceType, startTime, endTime, totalHkd }.
 * Validates the pet belongs to the caller, inserts a 'pending' booking, and
 * logs a booking_events entry (all inside withTenant, one transaction).
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

  const { petId, addressId, serviceType, startTime, endTime, totalHkd } =
    (body ?? {}) as {
      petId?: unknown;
      addressId?: unknown;
      serviceType?: unknown;
      startTime?: unknown;
      endTime?: unknown;
      totalHkd?: unknown;
    };

  if (typeof petId !== "string" || petId.length === 0) {
    return NextResponse.json({ error: "petId is required" }, { status: 400 });
  }
  if (typeof addressId !== "string" || addressId.length === 0) {
    return NextResponse.json({ error: "addressId is required" }, { status: 400 });
  }
  if (typeof serviceType !== "string" || serviceType.trim().length === 0) {
    return NextResponse.json(
      { error: "serviceType is required" },
      { status: 400 },
    );
  }
  if (typeof totalHkd !== "number" || !Number.isInteger(totalHkd)) {
    return NextResponse.json(
      { error: "totalHkd must be an integer" },
      { status: 400 },
    );
  }

  const start = typeof startTime === "string" ? new Date(startTime) : null;
  const end = typeof endTime === "string" ? new Date(endTime) : null;
  if (!start || Number.isNaN(start.getTime())) {
    return NextResponse.json(
      { error: "startTime must be a valid ISO date" },
      { status: 400 },
    );
  }
  if (!end || Number.isNaN(end.getTime())) {
    return NextResponse.json(
      { error: "endTime must be a valid ISO date" },
      { status: 400 },
    );
  }
  if (end <= start) {
    return NextResponse.json(
      { error: "endTime must be after startTime" },
      { status: 400 },
    );
  }

  try {
    const booking = await createBooking(organizationId, userId, {
      petId,
      addressId,
      serviceType: serviceType.trim(),
      startTime: start,
      endTime: end,
      totalHkd,
    });
    return NextResponse.json({ booking }, { status: 201 });
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === "P0001") {
      return NextResponse.json(
        { error: "Pet not found for this user" },
        { status: 404 },
      );
    }
    throw err;
  }
}

// Re-exported for callers that import the status type from the route module.
export type { BookingStatus };
