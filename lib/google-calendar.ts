import { google } from "googleapis";

/**
 * Google Calendar sync for bookings.
 *
 * When a booking is ACCEPTED, the Owner's calendar gets an event (which their
 * TimeTree setup mirrors). When it's CANCELLED/REJECTED, the event is removed.
 *
 * Auth: an OAuth2 client is built from the Google OAuth app credentials
 * (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET) and a long-lived refresh token
 * (GOOGLE_CALENDAR_REFRESH_TOKEN) obtained once for the Owner's account. The
 * auth library exchanges the refresh token for short-lived access tokens
 * automatically on each request.
 *
 * PRIVACY: the event description contains ONLY the client's name and a booking
 * reference. Sensitive access details (door codes, keycard info, vet details,
 * etc.) are deliberately NOT copied into the calendar event — they live in the
 * dashboard.
 *
 * Env is read lazily (inside the functions) so that a missing/invalid
 * configuration does not crash the build or unrelated routes — callers are
 * expected to wrap these in try/catch.
 */

const CALENDAR_ID = "primary";
const TIME_ZONE = "Asia/Hong_Kong";

/** Minimal shapes needed to build an event (loosely typed on purpose). */
export type CalendarBooking = {
  id: string;
  serviceType: string;
  startTime: Date | string;
  endTime: Date | string;
  guestName?: string | null;
};

export type CalendarPet = {
  name: string;
};

export type CalendarCustomer = {
  name?: string | null;
  email?: string | null;
} | null;

function getCalendarClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_CALENDAR_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Google Calendar is not configured (missing GOOGLE_CLIENT_ID, " +
        "GOOGLE_CLIENT_SECRET or GOOGLE_CALENDAR_REFRESH_TOKEN)",
    );
  }

  const auth = new google.auth.OAuth2(clientId, clientSecret);
  auth.setCredentials({ refresh_token: refreshToken });

  return google.calendar({ version: "v3", auth });
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

/**
 * Create a calendar event for an accepted booking and return its event id.
 *
 * Privacy-safe title/description:
 *   Title:       "[Booking] {pet.name} - {serviceType}"
 *   Description: "Client: {customer.name || booking.guestName} (Ref: {id})."
 */
export async function createCalendarEvent(
  booking: CalendarBooking,
  pet: CalendarPet,
  customer: CalendarCustomer,
): Promise<string> {
  const calendar = getCalendarClient();

  const clientName = customer?.name || booking.guestName || "Guest";

  const res = await calendar.events.insert({
    calendarId: CALENDAR_ID,
    requestBody: {
      summary: `[Booking] ${pet.name} - ${booking.serviceType}`,
      description:
        `Client: ${clientName} (Ref: ${booking.id}). ` +
        `Sensitive access details are in the dashboard.`,
      start: { dateTime: toIso(booking.startTime), timeZone: TIME_ZONE },
      end: { dateTime: toIso(booking.endTime), timeZone: TIME_ZONE },
    },
  });

  const eventId = res.data.id;
  if (!eventId) {
    throw new Error("Google Calendar did not return an event id");
  }
  return eventId;
}

/**
 * Delete a calendar event by id. Treats 404/410 (already gone) as success so a
 * double-cancel is idempotent.
 */
export async function deleteCalendarEvent(eventId: string): Promise<void> {
  const calendar = getCalendarClient();

  try {
    await calendar.events.delete({ calendarId: CALENDAR_ID, eventId });
  } catch (err) {
    const httpStatus =
      (err as { code?: number })?.code ??
      (err as { response?: { status?: number } })?.response?.status;
    if (httpStatus === 404 || httpStatus === 410) {
      // Already deleted — nothing to do.
      return;
    }
    throw err;
  }
}
