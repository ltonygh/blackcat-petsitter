-- ============================================================================
-- Migration 0009_bookings_google_event_id
-- Stores the Google Calendar event id for a booking so the event can be
-- deleted when the booking is cancelled/rejected. NULLABLE.
-- ============================================================================

--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "google_event_id" text;
