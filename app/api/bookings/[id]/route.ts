import { NextResponse } from "next/server";

import { auth } from "@/auth";
import {
  updateBooking,
  type BookingStatus,
  type UpdateBookingInput,
} from "@/db/queries/bookings";
import { bookingStatus } from "@/db/schema";

/** Valid statuses derived from the pgEnum (single source of truth). */
const VALID_STATUSES = new Set<string>(bookingStatus.enumValues);

function isStatus(value: unknown): value is BookingStatus {
  return typeof value === "string" && VALID_STATUSES.has(value);
}

function parseDate(value: unknown): Date | null | "invalid" {
  if (value === null) return null;
  if (typeof value !== "string") return "invalid";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "invalid" : d;
}

/**
 * PATCH /api/bookings/[id]
 *
 * Accepts a partial update body:
 *   { status?, proposalStartTime?, proposalEndTime?, proposalReason?, proposalStatus? }
 * Updates the booking within the caller's tenant and logs a booking_events row
 * when the status changes. Returns 404 if the booking is not visible (e.g.
 * another tenant's booking).
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: userId, organizationId } = session.user;
  const { id: bookingId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    status,
    proposalStartTime,
    proposalEndTime,
    proposalReason,
    proposalStatus,
  } = (body ?? {}) as {
    status?: unknown;
    proposalStartTime?: unknown;
    proposalEndTime?: unknown;
    proposalReason?: unknown;
    proposalStatus?: unknown;
  };

  const patch: UpdateBookingInput = {};

  if (status !== undefined) {
    if (!isStatus(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    patch.status = status;
  }

  if (proposalStartTime !== undefined) {
    const parsed = parseDate(proposalStartTime);
    if (parsed === "invalid") {
      return NextResponse.json(
        { error: "proposalStartTime must be a valid ISO date or null" },
        { status: 400 },
      );
    }
    patch.proposalStartTime = parsed;
  }

  if (proposalEndTime !== undefined) {
    const parsed = parseDate(proposalEndTime);
    if (parsed === "invalid") {
      return NextResponse.json(
        { error: "proposalEndTime must be a valid ISO date or null" },
        { status: 400 },
      );
    }
    patch.proposalEndTime = parsed;
  }

  if (proposalReason !== undefined) {
    if (proposalReason !== null && typeof proposalReason !== "string") {
      return NextResponse.json(
        { error: "proposalReason must be a string or null" },
        { status: 400 },
      );
    }
    patch.proposalReason = proposalReason as string | null;
  }

  if (proposalStatus !== undefined) {
    if (proposalStatus !== null && typeof proposalStatus !== "string") {
      return NextResponse.json(
        { error: "proposalStatus must be a string or null" },
        { status: 400 },
      );
    }
    patch.proposalStatus = proposalStatus as string | null;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { error: "No updatable fields provided" },
      { status: 400 },
    );
  }

  const updated = await updateBooking(organizationId, bookingId, userId, patch);
  if (!updated) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  return NextResponse.json({ booking: updated });
}
