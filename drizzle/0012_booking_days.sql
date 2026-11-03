-- ============================================================================
-- Migration 0012_booking_days
-- Per-day schedule for multi-day bookings. One row per service day; times are
-- nullable (the user may not specify them). Rows cascade-delete with the
-- parent booking. Tenancy is inherited via booking -> organization (no RLS on
-- booking_days itself; reached only through RLS-scoped bookings).
-- ============================================================================

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "booking_days" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "booking_id" uuid NOT NULL,
  "date" date NOT NULL,
  "start_time" timestamp with time zone,
  "end_time" timestamp with time zone
);

--> statement-breakpoint
ALTER TABLE "booking_days" ADD CONSTRAINT "booking_days_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE cascade ON UPDATE no action;
