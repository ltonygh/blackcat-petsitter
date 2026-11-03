import { NextResponse } from "next/server";

import { auth } from "@/auth";
import {
  createBookingInline,
  listBookings,
  type BookingStatus,
  type CreateInlineBookingInput,
  type InlineBookingDay,
  type InlinePetData,
} from "@/db/queries/bookings";
import type { BookingLineItem } from "@/db/schema";
import { DEFAULT_ORG_ID } from "@/db/queries/users";
import { sendGuestBookingMagicLink } from "@/lib/email";

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

/** Small helpers for parsing the nested body. */
function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

/**
 * Parse an array of pricing line items ({ id, name, price }). Returns null if
 * the value is present but malformed (so the caller can 400).
 */
function parseLineItems(
  v: unknown,
): { ok: true; items: BookingLineItem[] } | { ok: false } {
  if (v === undefined || v === null) return { ok: true, items: [] };
  if (!Array.isArray(v)) return { ok: false };
  const items: BookingLineItem[] = [];
  for (const raw of v) {
    const item = asRecord(raw);
    if (!item) return { ok: false };
    const { id, name, price } = item;
    if (typeof id !== "string" || id.trim().length === 0) return { ok: false };
    if (typeof name !== "string" || name.trim().length === 0) return { ok: false };
    if (typeof price !== "number" || !Number.isFinite(price)) return { ok: false };
    items.push({ id: id.trim(), name: name.trim(), price });
  }
  return { ok: true, items };
}

/**
 * POST /api/bookings
 *
 * Accepts BOTH authenticated and GUEST bookings. The body carries pet,
 * address and (for guests) contact data inline; the API creates all records:
 *
 * {
 *   serviceType, startTime, endTime, totalHkd,
 *   addressData: { fullAddress, doorCode, label? },
 *   petData: { name, type, breed?, weightKg?, vaccinated?, sterilized?,
 *              contagious?, appearance?, notes? },
 *   guestData?: { name, email, phone }   // guests only (no session)
 * }
 *
 * - With a session: uses session.user.id / organizationId; guestData ignored.
 * - Without a session: guestData is REQUIRED; the booking is created in
 *   DEFAULT_ORG_ID and a user row is created/reused from the guest's email.
 */
export async function POST(request: Request) {
  const session = await auth();
  const authedUser = session?.user ?? null;

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

  const { serviceType, startTime, endTime, totalHkd } = root;
  const addressData = asRecord(root.addressData);
  const petDataRaw = asRecord(root.petData);
  const guestData = asRecord(root.guestData);

  // --- top-level validation -------------------------------------------------
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

  let start = typeof startTime === "string" ? new Date(startTime) : null;
  let end = typeof endTime === "string" ? new Date(endTime) : null;
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

  // --- days (optional multi-day schedule) -----------------------------------
  // [{ date: "2026-10-29", startTime?: ISO, endTime?: ISO }, ...]
  // The main booking record keeps its start/end; when days are provided we
  // populate it from the FIRST day (whose times, if present, are authoritative).
  const daysRaw = root.days;
  type ParsedDay = { date: string; startTime: Date | null; endTime: Date | null };
  const days: ParsedDay[] = [];
  const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
  if (daysRaw !== undefined && daysRaw !== null) {
    if (!Array.isArray(daysRaw)) {
      return NextResponse.json(
        { error: "days must be an array" },
        { status: 400 },
      );
    }
    for (const entry of daysRaw) {
      const d = asRecord(entry);
      if (!d) {
        return NextResponse.json(
          { error: "each day must be an object" },
          { status: 400 },
        );
      }
      if (typeof d.date !== "string" || !DATE_ONLY.test(d.date)) {
        return NextResponse.json(
          { error: "each day.date must be a YYYY-MM-DD string" },
          { status: 400 },
        );
      }
      let dStart: Date | null = null;
      let dEnd: Date | null = null;
      if (d.startTime !== undefined && d.startTime !== null) {
        if (typeof d.startTime !== "string") {
          return NextResponse.json(
            { error: "day.startTime must be an ISO string or null" },
            { status: 400 },
          );
        }
        dStart = new Date(d.startTime);
        if (Number.isNaN(dStart.getTime())) {
          return NextResponse.json(
            { error: "day.startTime must be a valid ISO date" },
            { status: 400 },
          );
        }
      }
      if (d.endTime !== undefined && d.endTime !== null) {
        if (typeof d.endTime !== "string") {
          return NextResponse.json(
            { error: "day.endTime must be an ISO string or null" },
            { status: 400 },
          );
        }
        dEnd = new Date(d.endTime);
        if (Number.isNaN(dEnd.getTime())) {
          return NextResponse.json(
            { error: "day.endTime must be a valid ISO date" },
            { status: 400 },
          );
        }
      }
      if (dStart && dEnd && dEnd <= dStart) {
        return NextResponse.json(
          { error: "day.endTime must be after day.startTime" },
          { status: 400 },
        );
      }
      days.push({ date: d.date, startTime: dStart, endTime: dEnd });
    }

    // Populate the main booking times from the first day when it carries times.
    const first = days[0];
    if (first?.startTime) start = first.startTime;
    if (first?.endTime) end = first.endTime;
  }

  // --- addressData ----------------------------------------------------------
  if (!addressData) {
    return NextResponse.json(
      { error: "addressData is required" },
      { status: 400 },
    );
  }
  if (
    typeof addressData.fullAddress !== "string" ||
    addressData.fullAddress.trim().length === 0
  ) {
    return NextResponse.json(
      { error: "addressData.fullAddress is required" },
      { status: 400 },
    );
  }
  if (
    addressData.doorCode !== undefined &&
    addressData.doorCode !== null &&
    typeof addressData.doorCode !== "string"
  ) {
    return NextResponse.json(
      { error: "addressData.doorCode must be a string" },
      { status: 400 },
    );
  }

  // --- petData --------------------------------------------------------------
  if (!petDataRaw) {
    return NextResponse.json({ error: "petData is required" }, { status: 400 });
  }
  if (
    typeof petDataRaw.name !== "string" ||
    petDataRaw.name.trim().length === 0
  ) {
    return NextResponse.json(
      { error: "petData.name is required" },
      { status: 400 },
    );
  }
  if (
    typeof petDataRaw.type !== "string" ||
    petDataRaw.type.trim().length === 0
  ) {
    return NextResponse.json(
      { error: "petData.type is required" },
      { status: 400 },
    );
  }

  const boolOrUndef = (v: unknown): boolean | null | undefined => {
    if (v === undefined || v === null) return v === null ? null : undefined;
    return typeof v === "boolean" ? v : undefined;
  };

  const petData: InlinePetData = {
    // Optional existing saved pet to link (backend uses the stored pet and
    // ignores the client-supplied type when present).
    petId:
      typeof petDataRaw.petId === "string" &&
      petDataRaw.petId.trim().length > 0
        ? petDataRaw.petId.trim()
        : null,
    name: petDataRaw.name.trim(),
    type: petDataRaw.type.trim(),
    breed:
      typeof petDataRaw.breed === "string" ? petDataRaw.breed : null,
    weightKg:
      typeof petDataRaw.weightKg === "number" ||
      typeof petDataRaw.weightKg === "string"
        ? (petDataRaw.weightKg as number | string)
        : null,
    vaccinated: boolOrUndef(petDataRaw.vaccinated),
    sterilized: boolOrUndef(petDataRaw.sterilized),
    contagious: boolOrUndef(petDataRaw.contagious),
    appearance:
      typeof petDataRaw.appearance === "string"
        ? petDataRaw.appearance
        : null,
    notes: typeof petDataRaw.notes === "string" ? petDataRaw.notes : null,
  };

  // --- addOns & surcharges --------------------------------------------------
  const addOnsParsed = parseLineItems(root.addOns);
  if (!addOnsParsed.ok) {
    return NextResponse.json(
      { error: "addOns must be an array of { id, name, price }" },
      { status: 400 },
    );
  }
  const surchargesParsed = parseLineItems(root.surcharges);
  if (!surchargesParsed.ok) {
    return NextResponse.json(
      { error: "surcharges must be an array of { id, name, price }" },
      { status: 400 },
    );
  }

  // Optional integrity check: totalHkd should equal the sum of the submitted
  // line items plus the (client-computed) base. We cannot know the authoritative
  // base price server-side, so we only reject when the total is LESS than the
  // sum of add-ons + surcharges — a total that cannot possibly be correct.
  const itemsSum = [...addOnsParsed.items, ...surchargesParsed.items].reduce(
    (acc, it) => acc + it.price,
    0,
  );
  if (itemsSum > 0 && totalHkd < itemsSum) {
    return NextResponse.json(
      {
        error:
          "totalHkd is less than the sum of add-ons and surcharges",
      },
      { status: 400 },
    );
  }

  // --- guestData (required without a session) -------------------------------
  let guest: CreateInlineBookingInput["guestData"] = null;
  if (!authedUser) {
    if (!guestData) {
      return NextResponse.json(
        { error: "guestData is required for guest bookings" },
        { status: 400 },
      );
    }
    if (
      typeof guestData.name !== "string" ||
      guestData.name.trim().length === 0
    ) {
      return NextResponse.json(
        { error: "guestData.name is required" },
        { status: 400 },
      );
    }
    if (
      typeof guestData.email !== "string" ||
      !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(guestData.email)
    ) {
      return NextResponse.json(
        { error: "guestData.email is required" },
        { status: 400 },
      );
    }
    if (
      typeof guestData.phone !== "string" ||
      guestData.phone.trim().length === 0
    ) {
      return NextResponse.json(
        { error: "guestData.phone is required" },
        { status: 400 },
      );
    }
    guest = {
      name: guestData.name.trim(),
      email: guestData.email.trim(),
      phone: guestData.phone.trim(),
    };
  }

  // start/end were validated above; when days provided they are sourced from
  // the first day. Re-assert to satisfy the non-null contract of the query.
  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return NextResponse.json(
      { error: "startTime and endTime are required" },
      { status: 400 },
    );
  }
  if (end <= start) {
    return NextResponse.json(
      { error: "endTime must be after startTime" },
      { status: 400 },
    );
  }

  const organizationId = authedUser ? authedUser.organizationId : DEFAULT_ORG_ID;
  const userId = authedUser ? authedUser.id : null;

  try {
    const result = await createBookingInline(organizationId, userId, {
      serviceType: serviceType.trim(),
      startTime: start,
      endTime: end,
      totalHkd,
      petData,
      addOns: addOnsParsed.items,
      surcharges: surchargesParsed.items,
      ...(days.length > 0 ? { days } : {}),
      addressData: {
        fullAddress: addressData.fullAddress.trim(),
        doorCode:
          typeof addressData.doorCode === "string"
            ? addressData.doorCode
            : null,
        label: typeof addressData.label === "string" ? addressData.label : null,
      },
      guestData: guest,
    });

    // Best-effort magic-link email for guests (never blocks the booking).
    if (guest) {
      void sendGuestBookingMagicLink({
        to: guest.email,
        guestName: guest.name,
        serviceType: serviceType.trim(),
      }).catch(() => {});
    }

    return NextResponse.json({ booking: result.booking }, { status: 201 });
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === "P0002" || code === "P0003") {
      return NextResponse.json(
        { error: "Could not create booking for this email" },
        { status: 409 },
      );
    }
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
