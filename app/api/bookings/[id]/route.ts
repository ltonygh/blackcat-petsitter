import { NextResponse } from "next/server";

import { auth } from "@/auth";
import {
  getBookingForCalendar,
  updateBooking,
  type BookingStatus,
  type UpdateBookingInput,
} from "@/db/queries/bookings";
import {
  createCalendarEvent,
  deleteCalendarEvent,
} from "@/lib/google-calendar";
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
    cancellationReason,
    totalHkd,
  } = (body ?? {}) as {
    status?: unknown;
    proposalStartTime?: unknown;
    proposalEndTime?: unknown;
    proposalReason?: unknown;
    proposalStatus?: unknown;
    cancellationReason?: unknown;
    totalHkd?: unknown;
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

  if (totalHkd !== undefined) {
    if (
      typeof totalHkd !== "number" ||
      !Number.isInteger(totalHkd) ||
      totalHkd < 0
    ) {
      return NextResponse.json(
        { error: "totalHkd must be a non-negative integer" },
        { status: 400 },
      );
    }
    patch.totalHkd = totalHkd;
  }

  if (cancellationReason !== undefined) {
    if (
      cancellationReason !== null &&
      typeof cancellationReason !== "string"
    ) {
      return NextResponse.json(
        { error: "cancellationReason must be a string or null" },
        { status: 400 },
      );
    }
    // A cancellation reason only makes sense when cancelling.
    if (status !== "cancelled") {
      return NextResponse.json(
        {
          error:
            "cancellationReason may only be provided when status is 'cancelled'",
        },
        { status: 400 },
      );
    }
    patch.cancellationReason = cancellationReason as string | null;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { error: "No updatable fields provided" },
      { status: 400 },
    );
  }

  // Read the booking BEFORE updating so we can see its prior status and any
  // existing Google Calendar event id, plus pet/customer for the event payload.
  const beforeBooking = await getBookingForCalendar(organizationId, bookingId);
  if (!beforeBooking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  // Persist the update first — the DB update must succeed regardless of the
  // calendar sync outcome.
  const updated = await updateBooking(organizationId, bookingId, userId, patch);
  if (!updated) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  // --- Google Calendar sync (best-effort; never fails the request) ----------
  let syncedEventId: string | null | undefined;
  try {
    const nextStatus = updated.status;
    const prevStatus = beforeBooking.status;

    if (
      nextStatus === "accepted" &&
      prevStatus !== "accepted" &&
      !beforeBooking.googleEventId
    ) {
      // Newly accepted: create the event and store its id.
      const eventId = await createCalendarEvent(
        updated,
        { name: beforeBooking.pet?.name ?? "Pet" },
        beforeBooking.customer,
      );
      await updateBooking(organizationId, bookingId, userId, {
        googleEventId: eventId,
      });
      syncedEventId = eventId;
    } else if (
      (nextStatus === "cancelled" || nextStatus === "rejected") &&
      beforeBooking.googleEventId
    ) {
      // Cancelled/rejected: remove the event, then clear the stored id.
      await deleteCalendarEvent(beforeBooking.googleEventId);
      await updateBooking(organizationId, bookingId, userId, {
        googleEventId: null,
      });
      syncedEventId = null;
    }
  } catch (err) {
    // Google is down or misconfigured: log and continue. The booking state is
    // already persisted above.
    console.error(
      "[google-calendar] sync failed for booking",
      bookingId,
      err instanceof Error ? err.message : err,
    );
  }

  // Re-read so the response reflects any googleEventId change.
  const finalBooking =
    (await getBookingForCalendar(organizationId, bookingId)) ?? updated;

  return NextResponse.json({
    booking: finalBooking,
    ...(syncedEventId !== undefined ? { googleEventId: syncedEventId } : {}),
  });
}
