import { and, eq, isNull } from "drizzle-orm";

import { withTenant, type TenantTransaction } from "../client";
import {
  bookingEvents,
  bookings,
  pets,
  users,
  type bookingStatus,
} from "../schema";

/**
 * Tenant-scoped booking queries for the /api/bookings endpoints.
 *
 * `bookings` IS RLS-enabled (organization_id), so `withTenant` already scopes
 * every read/write here to the caller's organization. `booking_events` has no
 * RLS; it is only ever touched inside `withTenant`, and only for a booking
 * that itself resolved under RLS (so it cannot be a cross-tenant booking).
 */

/** Booking status union derived from the pgEnum (kept in sync automatically). */
export type BookingStatus = (typeof bookingStatus.enumValues)[number];

/**
 * Enriched booking shape returned by GET /api/bookings — matches the
 * frontend's `BookingWithDetails`:
 *   Booking & { pet: { id, name, type, iconKey }, customer: { id, email, name?, phone? } }
 *
 * Populated with Drizzle relational queries (`with: { pet, customer }`). The
 * `users` table has no `name`/`phone` columns today, so those fields are
 * `null` — kept in the type so the frontend contract is stable if/when the
 * columns are added.
 */
export type BookingWithDetails = typeof bookings.$inferSelect & {
  pet: {
    id: string;
    name: string;
    type: string;
    iconKey: string | null;
  } | null;
  customer: {
    id: string;
    email: string;
    name: string | null;
    phone: string | null;
  } | null;
};

export type CreateBookingInput = {
  petId: string;
  addressId: string;
  serviceType: string;
  startTime: Date;
  endTime: Date;
  totalHkd: number;
};

export type UpdateBookingInput = {
  status?: BookingStatus;
  proposalStartTime?: Date | null;
  proposalEndTime?: Date | null;
  proposalReason?: string | null;
  proposalStatus?: string | null;
};

/**
 * Verify a pet belongs to `userId` in `organizationId`. `pets` has no RLS, so
 * the `users` join + org filter is what enforces tenancy/ownership.
 */
async function petBelongsToUser(
  tx: TenantTransaction,
  organizationId: string,
  userId: string,
  petId: string,
): Promise<boolean> {
  const [row] = await tx
    .select({ id: pets.id })
    .from(pets)
    .innerJoin(users, eq(pets.userId, users.id))
    .where(
      and(
        eq(pets.id, petId),
        eq(pets.userId, userId),
        eq(users.organizationId, organizationId),
      ),
    )
    .limit(1);
  return Boolean(row);
}

/**
 * Create a booking (status 'pending') and log a booking_events row.
 *
 * GUARD: validates the pet belongs to the caller (via the pets -> users join)
 * before inserting. Runs entirely in one transaction so the booking and its
 * initial event are atomic.
 */
export async function createBooking(
  organizationId: string,
  userId: string,
  input: CreateBookingInput,
): Promise<typeof bookings.$inferSelect> {
  return withTenant(organizationId, async (tx) => {
    const ownsPet = await petBelongsToUser(
      tx,
      organizationId,
      userId,
      input.petId,
    );
    if (!ownsPet) {
      const err = new Error("Pet not found for this user") as Error & {
        code?: string;
      };
      err.code = "P0001";
      throw err;
    }

    const [booking] = await tx
      .insert(bookings)
      .values({
        organizationId,
        userId,
        petId: input.petId,
        addressId: input.addressId,
        serviceType: input.serviceType,
        startTime: input.startTime,
        endTime: input.endTime,
        totalHkd: input.totalHkd,
        status: "pending",
      })
      .returning();

    await tx.insert(bookingEvents).values({
      bookingId: booking.id,
      actorId: userId,
      fromStatus: null,
      toStatus: "pending",
      note: "Booking created",
    });

    return booking;
  });
}

/**
 * List bookings for the caller's role, enriched with pet + customer.
 *
 *   - 'user'  : only bookings where userId = caller
 *   - 'staff' : only bookings where staffId = caller
 *   - 'owner' : all bookings in the organization (RLS-scoped)
 *
 * Uses Drizzle relational queries so the result matches `BookingWithDetails`.
 */
export async function listBookings(
  organizationId: string,
  userId: string,
  role: "user" | "owner" | "staff",
): Promise<BookingWithDetails[]> {
  return withTenant(organizationId, async (tx) => {
    const roleFilter =
      role === "owner"
        ? eq(bookings.organizationId, organizationId)
        : role === "staff"
          ? eq(bookings.staffId, userId)
          : eq(bookings.userId, userId);

    const rows = await tx.query.bookings.findMany({
      where: and(isNull(bookings.deletedAt), roleFilter),
      with: {
        pet: { columns: { id: true, name: true, type: true, iconKey: true } },
        customer: { columns: { id: true, email: true } },
      },
      orderBy: (b, { desc }) => [desc(b.createdAt)],
    });

    return rows.map((row) => ({
      ...row,
      // `users` has no name/phone columns yet; expose the contract fields as
      // null so the frontend's BookingWithDetails shape is stable.
      customer: row.customer
        ? {
            id: row.customer.id,
            email: row.customer.email,
            name: null,
            phone: null,
          }
        : null,
    })) as BookingWithDetails[];
  });
}

/**
 * Fetch a single booking within the tenant (RLS-scoped). Returns null if not
 * visible (e.g. another tenant's booking) so the route can 404.
 */
export async function getBookingById(
  organizationId: string,
  bookingId: string,
): Promise<typeof bookings.$inferSelect | null> {
  return withTenant(organizationId, async (tx) => {
    const row = await tx.query.bookings.findFirst({
      where: and(
        eq(bookings.id, bookingId),
        isNull(bookings.deletedAt),
      ),
    });
    return row ?? null;
  });
}

/**
 * Partially update a booking within the tenant and log a status-change event
 * when the status changes.
 *
 * Returns the updated booking, or null if it was not visible in this tenant.
 * Runs in one transaction so the update and its event are atomic.
 */
export async function updateBooking(
  organizationId: string,
  bookingId: string,
  actorId: string,
  input: UpdateBookingInput,
): Promise<typeof bookings.$inferSelect | null> {
  return withTenant(organizationId, async (tx) => {
    const [existing] = await tx
      .select()
      .from(bookings)
      .where(
        and(eq(bookings.id, bookingId), isNull(bookings.deletedAt)),
      )
      .limit(1);

    if (!existing) return null;

    const [updated] = await tx
      .update(bookings)
      .set({
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.proposalStartTime !== undefined
          ? { proposalStartTime: input.proposalStartTime }
          : {}),
        ...(input.proposalEndTime !== undefined
          ? { proposalEndTime: input.proposalEndTime }
          : {}),
        ...(input.proposalReason !== undefined
          ? { proposalReason: input.proposalReason }
          : {}),
        ...(input.proposalStatus !== undefined
          ? { proposalStatus: input.proposalStatus }
          : {}),
      })
      .where(eq(bookings.id, bookingId))
      .returning();

    if (input.status !== undefined && input.status !== existing.status) {
      await tx.insert(bookingEvents).values({
        bookingId,
        actorId,
        fromStatus: existing.status,
        toStatus: input.status,
        note: "Status changed via API",
      });
    }

    return updated;
  });
}
